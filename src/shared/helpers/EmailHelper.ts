/**
 * Email Helper for VPS Deployment
 *
 * Supports AWS SES, SMTP, and Microsoft 365 OAuth2 via Graph API.
 * Configure via environment variables:
 *
 * For Microsoft 365 OAuth2 (recommended):
 *   MAIL_SYSTEM=LRC_OAUTH
 *   SMTP_CLIENT_ID=<Azure app client ID>
 *   SMTP_CLIENT_SECRET=<Azure app client secret>
 *   MS_TENANT_ID=<Azure tenant ID>
 *   MS_SENDER_EMAIL=<sender mailbox, e.g. support@domain.org>
 *
 * For AWS SES:
 *   MAIL_SYSTEM=ses
 *   AWS_REGION=us-east-1
 *   AWS_ACCESS_KEY_ID=your-key
 *   AWS_SECRET_ACCESS_KEY=your-secret
 *
 * For SMTP:
 *   MAIL_SYSTEM=smtp
 *   SMTP_HOST=smtp.office365.com
 *   SMTP_PORT=587
 *   SMTP_SECURE=false
 *   SMTP_USER=your-email@domain.org
 *   SMTP_PASS=your-password
 */

import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailHelper as UpstreamEmailHelper } from '@churchapps/apihelper';
import { Environment } from './Environment.js';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export class EmailHelper {
  private static smtpTransporter: nodemailer.Transporter | null = null;
  private static sesClient: SESClient | null = null;
  private static _patched = false;

  /**
   * Patch the upstream @churchapps/apihelper EmailHelper.sendEmail so that
   * sendTemplatedEmail (used throughout the codebase) routes through LRC_OAUTH
   * when MAIL_SYSTEM=LRC_OAUTH is configured.
   */
  static patchUpstream() {
    if (this._patched) return;
    this._patched = true;
    const original = (UpstreamEmailHelper as any).sendEmail.bind(UpstreamEmailHelper);
    (UpstreamEmailHelper as any).sendEmail = async (payload: { from: string; to: string; subject: string; body: string; replyTo?: string }) => {
      const mailSystem = process.env.MAIL_SYSTEM || '';
      if (mailSystem === 'LRC_OAUTH') {
        await EmailHelper.sendViaGraphApi(payload.to, payload.subject, payload.body, payload.replyTo);
      } else {
        await original(payload);
      }
    };
    console.log('Email service patched: upstream sendEmail intercepted for LRC_OAUTH support');
  }

  /**
   * Obtain an OAuth2 access token from Microsoft identity platform using
   * client credentials flow (application permissions — Mail.Send).
   */
  private static async getGraphAccessToken(): Promise<string> {
    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.SMTP_CLIENT_ID;
    const clientSecret = process.env.SMTP_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) throw new Error('Microsoft OAuth2 env vars not set (MS_TENANT_ID, SMTP_CLIENT_ID, SMTP_CLIENT_SECRET)');

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });

    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Failed to obtain MS access token: ${err}`);
    }
    const data = await resp.json() as { access_token: string };
    return data.access_token;
  }

  /**
   * Send email via Microsoft Graph API (sendMail endpoint).
   */
  static async sendViaGraphApi(to: string | string[], subject: string, html: string, replyTo?: string): Promise<void> {
    const senderEmail = process.env.MS_SENDER_EMAIL || Environment.supportEmail;
    const toAddresses = Array.isArray(to) ? to : [to];
    const token = await EmailHelper.getGraphAccessToken();

    const message: Record<string, any> = {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: toAddresses.map(addr => ({ emailAddress: { address: addr } })),
      from: { emailAddress: { address: senderEmail } }
    };
    if (replyTo) message.replyTo = [{ emailAddress: { address: replyTo } }];

    const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true })
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Graph API sendMail failed: ${err}`);
    }
    console.log(`Email sent via Microsoft Graph to ${toAddresses.join(', ')}`);
  }

  /**
   * Initialize email service based on MAIL_SYSTEM environment variable.
   * Used by the local send() method for direct calls.
   */
  private static initialize() {
    const mailSystem = process.env.MAIL_SYSTEM || 'smtp';

    if (mailSystem === 'ses') {
      if (!this.sesClient) {
        this.sesClient = new SESClient({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          } : undefined
        });
        console.log('Email service initialized: AWS SES');
      }
    } else if (mailSystem === 'smtp') {
      if (!this.smtpTransporter) {
        const smtpConfig = {
          host: process.env.SMTP_HOST || 'smtp.office365.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        };
        this.smtpTransporter = nodemailer.createTransport(smtpConfig);
        console.log(`Email service initialized: SMTP (${smtpConfig.host}:${smtpConfig.port})`);
      }
    } else if (mailSystem === 'LRC_OAUTH') {
      console.log('Email service initialized: Microsoft 365 OAuth2 (Graph API)');
    } else {
      console.warn(`Unknown MAIL_SYSTEM: ${mailSystem}. Email sending disabled.`);
    }
  }

  /**
   * Send email using configured mail system (direct call path).
   */
  static async send(options: EmailOptions): Promise<boolean> {
    try {
      this.initialize();
      const mailSystem = process.env.MAIL_SYSTEM || 'smtp';
      const fromAddress = options.from || Environment.supportEmail || 'noreply@lifereformationcentre.org';
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

      if (mailSystem === 'LRC_OAUTH') {
        await this.sendViaGraphApi(options.to, options.subject, options.html, options.replyTo);
        return true;
      } else if (mailSystem === 'ses' && this.sesClient) {
        return await this.sendViaSES(options, fromAddress);
      } else if (mailSystem === 'smtp' && this.smtpTransporter) {
        return await this.sendViaSMTP(options, fromAddress);
      } else {
        console.error('Email service not initialized');
        return false;
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  private static async sendViaSES(options: EmailOptions, fromAddress: string): Promise<boolean> {
    try {
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
      const command = new SendEmailCommand({
        Source: fromAddress,
        Destination: { ToAddresses: toAddresses },
        Message: {
          Subject: { Data: options.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: options.html, Charset: 'UTF-8' },
            ...(options.text && { Text: { Data: options.text, Charset: 'UTF-8' } })
          }
        },
        ...(options.replyTo && { ReplyToAddresses: [options.replyTo] })
      });
      const response = await this.sesClient!.send(command);
      console.log(`Email sent via SES to ${toAddresses.join(', ')} (MessageId: ${response.MessageId})`);
      return true;
    } catch (error) {
      console.error('SES send failed:', error);
      throw error;
    }
  }

  private static async sendViaSMTP(options: EmailOptions, fromAddress: string): Promise<boolean> {
    try {
      const info = await this.smtpTransporter!.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo
      });
      console.log(`Email sent via SMTP to ${options.to} (MessageId: ${info.messageId})`);
      return true;
    } catch (error) {
      console.error('SMTP send failed:', error);
      throw error;
    }
  }

  static async verify(): Promise<boolean> {
    try {
      this.initialize();
      const mailSystem = process.env.MAIL_SYSTEM || 'smtp';
      if (mailSystem === 'LRC_OAUTH') {
        await this.getGraphAccessToken();
        console.log('Microsoft Graph OAuth2 token obtained — email service verified');
        return true;
      } else if (mailSystem === 'smtp' && this.smtpTransporter) {
        await this.smtpTransporter.verify();
        console.log('SMTP connection verified');
        return true;
      } else if (mailSystem === 'ses' && this.sesClient) {
        console.log('SES client initialized');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Email service verification failed:', error);
      return false;
    }
  }

  static close() {
    if (this.smtpTransporter) {
      this.smtpTransporter.close();
      this.smtpTransporter = null;
      console.log('SMTP connection closed');
    }
  }
}

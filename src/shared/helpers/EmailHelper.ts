/**
 * Email Helper for VPS Deployment
 * 
 * Supports both AWS SES and SMTP for sending emails.
 * Configure via environment variables:
 * 
 * For AWS SES:
 *   MAIL_SYSTEM=ses
 *   AWS_REGION=us-east-1
 *   AWS_ACCESS_KEY_ID=your-key
 *   AWS_SECRET_ACCESS_KEY=your-secret
 * 
 * For SMTP:
 *   MAIL_SYSTEM=smtp
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_SECURE=false
 *   SMTP_USER=your-email@gmail.com
 *   SMTP_PASS=your-password
 */

import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
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

  /**
   * Initialize email service based on MAIL_SYSTEM environment variable
   */
  private static initialize() {
    const mailSystem = process.env.MAIL_SYSTEM || 'smtp';

    if (mailSystem === 'ses') {
      // Initialize AWS SES client
      if (!this.sesClient) {
        this.sesClient = new SESClient({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          } : undefined
        });
        console.log('✅ Email service initialized: AWS SES');
      }
    } else if (mailSystem === 'smtp') {
      // Initialize SMTP transporter
      if (!this.smtpTransporter) {
        const smtpConfig = {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        };

        this.smtpTransporter = nodemailer.createTransport(smtpConfig);
        console.log(`✅ Email service initialized: SMTP (${smtpConfig.host}:${smtpConfig.port})`);
      }
    } else {
      console.warn(`⚠️ Unknown MAIL_SYSTEM: ${mailSystem}. Email sending disabled.`);
    }
  }

  /**
   * Send email using configured mail system
   */
  static async send(options: EmailOptions): Promise<boolean> {
    try {
      this.initialize();

      const mailSystem = process.env.MAIL_SYSTEM || 'smtp';
      const fromAddress = options.from || Environment.supportEmail || 'noreply@churchapps.org';

      if (mailSystem === 'ses' && this.sesClient) {
        return await this.sendViaSES(options, fromAddress);
      } else if (mailSystem === 'smtp' && this.smtpTransporter) {
        return await this.sendViaSMTP(options, fromAddress);
      } else {
        console.error('❌ Email service not initialized');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send email via AWS SES
   */
  private static async sendViaSES(options: EmailOptions, fromAddress: string): Promise<boolean> {
    try {
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

      const command = new SendEmailCommand({
        Source: fromAddress,
        Destination: {
          ToAddresses: toAddresses
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: options.html,
              Charset: 'UTF-8'
            },
            ...(options.text && {
              Text: {
                Data: options.text,
                Charset: 'UTF-8'
              }
            })
          }
        },
        ...(options.replyTo && {
          ReplyToAddresses: [options.replyTo]
        })
      });

      const response = await this.sesClient!.send(command);
      console.log(`✅ Email sent via SES to ${toAddresses.join(', ')} (MessageId: ${response.MessageId})`);
      return true;
    } catch (error) {
      console.error('❌ SES send failed:', error);
      throw error;
    }
  }

  /**
   * Send email via SMTP
   */
  private static async sendViaSMTP(options: EmailOptions, fromAddress: string): Promise<boolean> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo
      };

      const info = await this.smtpTransporter!.sendMail(mailOptions);
      console.log(`✅ Email sent via SMTP to ${options.to} (MessageId: ${info.messageId})`);
      return true;
    } catch (error) {
      console.error('❌ SMTP send failed:', error);
      throw error;
    }
  }

  /**
   * Verify email service connection
   */
  static async verify(): Promise<boolean> {
    try {
      this.initialize();

      const mailSystem = process.env.MAIL_SYSTEM || 'smtp';

      if (mailSystem === 'smtp' && this.smtpTransporter) {
        await this.smtpTransporter.verify();
        console.log('✅ SMTP connection verified');
        return true;
      } else if (mailSystem === 'ses' && this.sesClient) {
        // SES doesn't have a verify method, assume it's configured correctly
        console.log('✅ SES client initialized');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Email service verification failed:', error);
      return false;
    }
  }

  /**
   * Close SMTP connection (if using SMTP)
   */
  static close() {
    if (this.smtpTransporter) {
      this.smtpTransporter.close();
      this.smtpTransporter = null;
      console.log('✅ SMTP connection closed');
    }
  }
}

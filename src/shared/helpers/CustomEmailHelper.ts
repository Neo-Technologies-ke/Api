import { EnvironmentBase, IEmailPayload, EmailHelper as OldEmailHelper } from "@churchapps/apihelper";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

export class CustomEnvironment extends EnvironmentBase {
  static smtpClientId: string;
  static smtpClientSecret: string;
  static smtpRefreshToken: string;
  static microsoftTenantID: string;
  static microsoftSenderEmail: string;

  static populateOAuth() {
    this.smtpClientId = process.env.SMTP_CLIENT_ID;
    this.smtpClientSecret = process.env.SMTP_CLIENT_SECRET;
    this.smtpRefreshToken = process.env.SMTP_REFRESH_TOKEN;
    this.microsoftTenantID = process.env.MS_TENANT_ID;
    this.microsoftSenderEmail = process.env.MS_SENDER_EMAIL;
  }
}

export class EmailHelper extends OldEmailHelper {
  public static readTemplate(templateName: string): string {
    const candidates = [
      path.join(process.cwd(), "src", "shared", "templates", templateName),
      path.join(process.cwd(), "dist", "src", "shared", "templates", templateName),
      path.join(process.cwd(), "src", "shared", "templates", "LifeReformationEmailTemplate.html"),
      path.join(process.cwd(), "dist", "src", "shared", "templates", "LifeReformationEmailTemplate.html"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    }
    return OldEmailHelper.readTemplate(templateName);
  }
  public static async sendTemplatedEmail(
    from: string,
    to: string,
    appName: string,
    appUrl: string,
    subject: string,
    contents: string,
    emailTemplate:
      | "EmailTemplate.html"
      | "ChurchEmailTemplate.html"
      | "LifeReformationEmailTemplate.html" = "EmailTemplate.html",
    replyTo?: string
  ): Promise<void> {
    if (!appName) appName = "Life Reformation Centre";
    if (!appUrl) appUrl = "https://lifereformationcentre.org";
    const template = EmailHelper.readTemplate(emailTemplate);
    const body = template
      .replace("{appLink}", appUrl)
      .replace("{appName}", appName)
      .replace("{subject}", subject)
      .replace("{contents}", contents);
    await EmailHelper.sendEmail({ from, to, subject, body, replyTo });
  }

  public static async sendEmail({
    from,
    to,
    subject,
    body,
    replyTo
  }: IEmailPayload): Promise<void> {
    if (EnvironmentBase.mailSystem === "LRC_OAUTH") {

      // const transporter = nodemailer.createTransport({
      //   host: "smtp.office365.com",
      //   secure: EnvironmentBase.smtpSecure,
      //   port: 587,
      //   tls: { ciphers: "SSLv3" },
      //   requireTLS: true,
      //   auth: {
      //     type: "OAuth2",
      //     user: CustomEnvironment.microsoftSenderEmail,
      //     clientId: CustomEnvironment.smtpClientId,
      //     clientSecret: CustomEnvironment.smtpClientSecret,
      //     accessUrl: `https://login.microsoftonline.com/${CustomEnvironment.microsoftTenantID}/oauth2/v2.0/token`
      //   }
      // });
      // await transporter.sendMail({ from, to, subject, html: body, replyTo });


      let oAuthToken: string;
      await axios({
        // Get OAuth token to connect as OAuth client
        method: "post",
        url: `https://login.microsoftonline.com/${CustomEnvironment.microsoftTenantID}/oauth2/v2.0/token`,
        data: new URLSearchParams({
          client_id: CustomEnvironment.smtpClientId,
          client_secret: CustomEnvironment.smtpClientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials"
        }).toString()
      }).then((r) => {
        oAuthToken = r.data.access_token;
      });

      await axios({
        // Send Email using Microsoft Graph
        method: "post",
        url: `https://graph.microsoft.com/v1.0/users/${CustomEnvironment.microsoftSenderEmail}/sendMail`,
        headers: {
          Authorization: "Bearer " + oAuthToken,
          "Content-Type": "application/json"
        },
        data: {
          message: {
            subject,
            body: {
              contentType: "HTML",
              content: body
            },
            toRecipients: [{ emailAddress: { address: to } }]
          }
        }
      }).catch((r) => {
        // console.log(r)
        throw r;
      });
    } else {
      await OldEmailHelper.sendEmail({ from, to, subject, body, replyTo });
    }
  }
}

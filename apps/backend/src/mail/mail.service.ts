import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null = null;
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
    this.fromEmail =
      process.env.MAIL_FROM ?? 'Kyu Chatter <noreply@kyuchatter.com>';
  }

  /**
   * Sends an email via Resend if API key is provided, or logs in development.
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.log(
        `[Dev Mail Delivery] To: ${to} | Subject: "${subject}"`,
      );
      return true;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });
      return true;
    } catch (err: any) {
      this.logger.warn(`Failed to send email to ${to}: ${err.message}`);
      return false;
    }
  }

  /**
   * Sends account email verification link.
   */
  async sendVerificationEmail(to: string, url: string): Promise<boolean> {
    const subject = 'Verify your email for Kyu Chatter';
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Welcome to Kyu Chatter!</h2>
        <p>Please verify your email address to complete your registration by clicking the link below:</p>
        <p style="margin: 24px 0;">
          <a href="${url}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a>
        </p>
        <p style="color: #6B7280; font-size: 14px;">If you did not request this, please ignore this email.</p>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }

  /**
   * Sends password reset request link.
   */
  async sendPasswordResetEmail(to: string, url: string): Promise<boolean> {
    const subject = 'Reset your Kyu Chatter password';
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <p style="margin: 24px 0;">
          <a href="${url}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        </p>
        <p style="color: #6B7280; font-size: 14px;">This link is valid for 1 hour. If you did not make this request, you can safely ignore this message.</p>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }
}

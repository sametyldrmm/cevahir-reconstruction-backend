import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  MailPayloads,
  MailTemplate,
  SendEmailParams,
  SendMailParams,
} from './mail.types';
import { getSubjectByTemplate, renderTemplate } from './mail.helper';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000;
  private readonly fromEmail: string;
  private readonly replyToEmail: string;

  constructor() {
    this.fromEmail = process.env.SMTP_FROM || 'noreply@example.com';
    this.replyToEmail = process.env.SMTP_REPLY_TO || this.fromEmail;
    this.initializeSMTP();
  }

  private initializeSMTP() {
    try {
      const smtpConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
        tls: {
          rejectUnauthorized:
            process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
        },
      };

      this.transporter = nodemailer.createTransport(smtpConfig);
      this.logger.log('SMTP transporter initialized');
    } catch (error: any) {
      this.logger.error('Failed to initialize SMTP transporter:', error);
    }
  }

  private async sendWithRetry(
    mailOptions: nodemailer.SendMailOptions,
  ): Promise<nodemailer.SentMessageInfo> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Attempt ${attempt}/${this.maxRetries} to send email via SMTP`,
        );

        const result = await this.transporter.sendMail(mailOptions);
        this.logger.log(
          `Email sent successfully on attempt ${attempt}, MessageId: ${result.messageId}`,
        );
        return result;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(`Attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          this.logger.debug(`Waiting ${this.retryDelay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    throw lastError || new Error('Failed to send email after retries');
  }

  private convertHtmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  async sendEmail(
    toEmail: string,
    htmlContent: string,
    subject?: string,
  ): Promise<boolean> {
    try {
      if (!this.transporter) {
        this.logger.warn(
          'SMTP transporter is not configured. Email sending is disabled.',
        );
        return false;
      }

      this.logger.debug(`Attempting to send email to ${toEmail} via SMTP`);

      const mailOptions: nodemailer.SendMailOptions = {
        from: this.fromEmail,
        to: toEmail,
        replyTo: this.replyToEmail,
        subject: subject || 'CPM Günlük Hedefler Takip Sistemi',
        html: htmlContent,
        text: this.convertHtmlToText(htmlContent),
      };

      await this.sendWithRetry(mailOptions);
      return true;
    } catch (error: any) {
      this.logger.error('Email gönderimi sırasında hata:', error);
      return false;
    }
  }

  async sendEmailWithAttachment(
    toEmail: string,
    htmlContent: string,
    attachment: {
      filename: string;
      path: string;
      contentType?: string;
    },
    subject?: string,
  ): Promise<boolean> {
    try {
      if (!this.transporter) {
        this.logger.warn(
          'SMTP transporter is not configured. Email sending is disabled.',
        );
        return false;
      }

      this.logger.debug(
        `Attempting to send email with attachment to ${toEmail} via SMTP`,
      );

      const mailOptions: nodemailer.SendMailOptions = {
        from: this.fromEmail,
        to: toEmail,
        replyTo: this.replyToEmail,
        subject: subject || 'CPM Günlük Hedefler Takip Sistemi',
        html: htmlContent,
        text: this.convertHtmlToText(htmlContent),
        attachments: [
          {
            filename: attachment.filename,
            path: attachment.path,
            contentType: attachment.contentType,
          },
        ],
      };

      await this.sendWithRetry(mailOptions);
      return true;
    } catch (error: any) {
      this.logger.error('Email gönderimi sırasında hata:', error);
      return false;
    }
  }

  async sendTemplateEmail<T extends MailTemplate>(
    params: SendMailParams<T>,
  ): Promise<boolean> {
    try {
      const { to, subject, template, payload, language = 'tr' } = params;

      this.logger.debug(
        `Attempting to send template email to ${to} using template: ${template}`,
      );

      const htmlContent = renderTemplate(template, payload, language);
      const emailSubject = subject || getSubjectByTemplate(template, language);

      return await this.sendEmail(to, htmlContent, emailSubject);
    } catch (error: any) {
      this.logger.error('Template email gönderimi sırasında hata:', error);
      return false;
    }
  }

  async sendVerificationCode(
    toEmail: string,
    verificationCode: string,
    type: 'register' | 'forgot-password' | 'change-email',
    username?: string,
    language: 'tr' | 'en' = 'tr',
  ): Promise<boolean> {
    try {
      const templateMap: Record<
        'register' | 'forgot-password' | 'change-email',
        MailTemplate
      > = {
        register: MailTemplate.REGISTER,
        'forgot-password': MailTemplate.FORGOT_PASSWORD,
        'change-email': MailTemplate.CHANGE_EMAIL,
      };

      const template = templateMap[type];

      const payload: MailPayloads[MailTemplate] = {
        username: username || 'Kullanıcı',
        verificationCode,
        email: toEmail,
        ...(type === 'change-email' && { newEmail: toEmail }),
        ...(type === 'forgot-password' && { resetCode: verificationCode }),
      } as any;

      return this.sendTemplateEmail({
        to: toEmail,
        template,
        payload,
        language,
      } as any);
    } catch (error: any) {
      this.logger.error(
        'Verification code email gönderimi sırasında hata:',
        error,
      );
      return false;
    }
  }

  async sendWelcomeEmail(
    toEmail: string,
    username: string,
    language: 'tr' | 'en' = 'tr',
  ): Promise<boolean> {
    return this.sendTemplateEmail({
      to: toEmail,
      template: MailTemplate.WELCOME,
      payload: { username, email: toEmail },
      language,
    });
  }

  async sendNotificationEmail(
    toEmail: string,
    username: string,
    title: string,
    message: string,
    language: 'tr' | 'en' = 'tr',
  ): Promise<boolean> {
    return this.sendTemplateEmail({
      to: toEmail,
      template: MailTemplate.NOTIFICATION,
      payload: { username, title, message },
      language,
    });
  }

  async sendPaymentSuccessEmail(
    toEmail: string,
    username: string,
    amount: number,
    currency: string,
    transactionId: string,
    language: 'tr' | 'en' = 'tr',
  ): Promise<boolean> {
    return this.sendTemplateEmail({
      to: toEmail,
      template: MailTemplate.PAYMENT_SUCCESS,
      payload: { username, amount, currency, transactionId },
      language,
    });
  }

  async sendPaymentFailedEmail(
    toEmail: string,
    username: string,
    amount: number,
    currency: string,
    errorMessage: string,
    language: 'tr' | 'en' = 'tr',
  ): Promise<boolean> {
    return this.sendTemplateEmail({
      to: toEmail,
      template: MailTemplate.PAYMENT_FAILED,
      payload: { username, amount, currency, errorMessage },
      language,
    });
  }

  async sendUploadSuccessEmail(
    toEmail: string,
    username: string,
    fileName: string,
    fileType: string,
    language: 'tr' | 'en' = 'tr',
  ): Promise<boolean> {
    return this.sendTemplateEmail({
      to: toEmail,
      template: MailTemplate.UPLOAD_SUCCESS,
      payload: { username, fileName, fileType },
      language,
    });
  }

  async sendUploadFailedEmail(
    toEmail: string,
    username: string,
    fileName: string,
    errorMessage: string,
    language: 'tr' | 'en' = 'tr',
  ): Promise<boolean> {
    return this.sendTemplateEmail({
      to: toEmail,
      template: MailTemplate.UPLOAD_FAILED,
      payload: { username, fileName, errorMessage },
      language,
    });
  }
}

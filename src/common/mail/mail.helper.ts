import * as fs from 'fs';
import * as path from 'path';
import { MailPayloads, MailTemplate } from './mail.types';

export function renderTemplate<T extends MailTemplate>(
  templateName: T,
  payload: MailPayloads[T],
  language: 'tr' | 'en' = 'tr',
): string {
  const templatePath = path.join(
    process.cwd(),
    'src',
    'common',
    'mail',
    'templates',
    `${templateName}.${language}.html`,
  );

  try {
    let template = fs.readFileSync(templatePath, 'utf-8');

    Object.keys(payload).forEach((key) => {
      const value = (payload as any)[key];
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      template = template.replace(regex, String(value));
    });

    template = template.replace(
      /\{\{\s*DOMAIN_NAME\s*\}\}/g,
      process.env.DOMAIN_NAME || 'CevahirCPM.com',
    );
    template = template.replace(
      /\{\{\s*SMTP_FROM\s*\}\}/g,
      process.env.SMTP_FROM || 'info@CevahirCPM.com',
    );
    template = template.replace(
      /\{\{\s*CURRENT_YEAR\s*\}\}/g,
      new Date().getFullYear().toString(),
    );

    return template;
  } catch {
    throw new Error(
      `Template not found or invalid: ${templateName}.${language}.html`,
    );
  }
}

export function getSubjectByTemplate<T extends MailTemplate>(
  template: T,
  language: 'tr' | 'en' = 'tr',
): string {
  const subjects: Record<
    MailTemplate,
    {
      tr: string;
      en: string;
    }
  > = {
    [MailTemplate.REGISTER]: {
      tr: 'CevahirCPM - Hesap Doğrulama Kodu',
      en: 'CevahirCPM - Account Verification Code',
    },
    [MailTemplate.FORGOT_PASSWORD]: {
      tr: 'CevahirCPM - Şifre Sıfırlama Kodu',
      en: 'CevahirCPM - Password Reset Code',
    },
    [MailTemplate.CHANGE_EMAIL]: {
      tr: 'CevahirCPM - Email Değişikliği Doğrulama Kodu',
      en: 'CevahirCPM - Email Change Verification Code',
    },
    [MailTemplate.VERIFICATION_CODE]: {
      tr: 'CevahirCPM - Doğrulama Kodu',
      en: 'CevahirCPM - Verification Code',
    },
    [MailTemplate.WELCOME]: {
      tr: 'CevahirCPM - Hoş Geldiniz!',
      en: 'CevahirCPM - Welcome!',
    },
    [MailTemplate.NOTIFICATION]: {
      tr: 'CevahirCPM - Bildirim',
      en: 'CevahirCPM - Notification',
    },
    [MailTemplate.PAYMENT_SUCCESS]: {
      tr: 'CevahirCPM - Ödeme Başarılı',
      en: 'CevahirCPM - Payment Successful',
    },
    [MailTemplate.PAYMENT_FAILED]: {
      tr: 'CevahirCPM - Ödeme Başarısız',
      en: 'CevahirCPM - Payment Failed',
    },
    [MailTemplate.UPLOAD_SUCCESS]: {
      tr: 'CevahirCPM - Dosya Yükleme Başarılı',
      en: 'CevahirCPM - File Upload Successful',
    },
    [MailTemplate.UPLOAD_FAILED]: {
      tr: 'CevahirCPM - Dosya Yükleme Başarısız',
      en: 'CevahirCPM - File Upload Failed',
    },
    [MailTemplate.ADMIN_NOTIFICATION]: {
      tr: 'CevahirCPM - Admin Bildirimi',
      en: 'CevahirCPM - Admin Notification',
    },
  };

  return subjects[template]?.[language] || 'CevahirCPM Notification';
}

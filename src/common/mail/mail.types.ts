export enum MailTemplate {
  REGISTER = 'register',
  FORGOT_PASSWORD = 'forgot-password',
  CHANGE_EMAIL = 'change-email',
  VERIFICATION_CODE = 'verification-code',
  WELCOME = 'welcome',
  NOTIFICATION = 'notification',
  PAYMENT_SUCCESS = 'payment-success',
  PAYMENT_FAILED = 'payment-failed',
  UPLOAD_SUCCESS = 'upload-success',
  UPLOAD_FAILED = 'upload-failed',
  ADMIN_NOTIFICATION = 'admin-notification',
}

export type MailPayloads = {
  [MailTemplate.REGISTER]: {
    username: string;
    verificationCode: string;
    email: string;
  };
  [MailTemplate.FORGOT_PASSWORD]: {
    username: string;
    resetCode: string;
    email: string;
  };
  [MailTemplate.CHANGE_EMAIL]: {
    username: string;
    verificationCode: string;
    newEmail: string;
  };
  [MailTemplate.VERIFICATION_CODE]: {
    username: string;
    verificationCode: string;
    email: string;
    type: 'register' | 'forgot-password' | 'change-email';
  };
  [MailTemplate.WELCOME]: {
    username: string;
    email: string;
  };
  [MailTemplate.NOTIFICATION]: {
    username: string;
    message: string;
    title: string;
  };
  [MailTemplate.PAYMENT_SUCCESS]: {
    username: string;
    amount: number;
    currency: string;
    transactionId: string;
  };
  [MailTemplate.PAYMENT_FAILED]: {
    username: string;
    amount: number;
    currency: string;
    errorMessage: string;
  };
  [MailTemplate.UPLOAD_SUCCESS]: {
    username: string;
    fileName: string;
    fileType: string;
  };
  [MailTemplate.UPLOAD_FAILED]: {
    username: string;
    fileName: string;
    errorMessage: string;
  };
  [MailTemplate.ADMIN_NOTIFICATION]: {
    adminName: string;
    message: string;
    title: string;
  };
};

export interface SendMailParams<T extends MailTemplate> {
  to: string;
  subject?: string;
  template: T;
  payload: MailPayloads[T];
  language?: 'tr' | 'en';
}

export interface SendEmailParams {
  toEmail: string;
  htmlContent: string;
  subject?: string;
}

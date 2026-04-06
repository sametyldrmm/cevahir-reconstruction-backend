import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { MailService } from './mail.service';
import { MailTemplate } from './mail.types';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';

export class SendEmailDto {
  @IsEmail()
  toEmail!: string;

  @IsString()
  htmlContent!: string;

  @IsOptional()
  @IsString()
  subject?: string;
}

export class SendVerificationCodeDto {
  @IsEmail()
  toEmail!: string;

  @IsString()
  verificationCode!: string;

  @IsIn(['register', 'forgot-password', 'change-email'])
  type!: 'register' | 'forgot-password' | 'change-email';

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';
}

export class SendWelcomeEmailDto {
  @IsEmail()
  toEmail!: string;

  @IsString()
  username!: string;

  @IsOptional()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';
}

export class SendNotificationEmailDto {
  @IsEmail()
  toEmail!: string;

  @IsString()
  username!: string;

  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';
}

export class SendPaymentEmailDto {
  @IsEmail()
  toEmail!: string;

  @IsString()
  username!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsString()
  transactionId!: string;

  @IsOptional()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';
}

export class SendPaymentFailedEmailDto {
  @IsEmail()
  toEmail!: string;

  @IsString()
  username!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsString()
  errorMessage!: string;

  @IsOptional()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';
}

export class SendUploadEmailDto {
  @IsEmail()
  toEmail!: string;

  @IsString()
  username!: string;

  @IsString()
  fileName!: string;

  @IsString()
  fileType!: string;

  @IsOptional()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';
}

export class SendUploadFailedEmailDto {
  @IsEmail()
  toEmail!: string;

  @IsString()
  username!: string;

  @IsString()
  fileName!: string;

  @IsString()
  errorMessage!: string;

  @IsOptional()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';
}

export class SendTemplateEmailDto {
  @IsEmail()
  to!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsEnum(MailTemplate)
  template!: MailTemplate;

  @IsString()
  payload!: string;

  @IsOptional()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';
}

@ApiTags('Mail Test')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('mail-test')
export class MailTestController {
  private readonly logger = new Logger(MailTestController.name);

  constructor(private readonly mailService: MailService) {}

  @Post('send-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test email gönder',
    description: 'Belirtilen e-posta adresine test e-postası gönderir.',
  })
  @ApiResponse({ status: 200, description: 'E-posta gönderim sonucu' })
  async sendEmail(@Body() dto: SendEmailDto) {
    try {
      this.logger.log(`Testing sendEmail to: ${dto.toEmail}`);
      const result = await this.mailService.sendEmail(
        dto.toEmail,
        dto.htmlContent,
      );

      return {
        success: result,
        message: result ? 'Email sent successfully' : 'Failed to send email',
        data: {
          to: dto.toEmail,
          subject: dto.subject || 'CevahirCPM Notification',
        },
      };
    } catch (error: any) {
      this.logger.error('Error in sendEmail test:', error);
      return {
        success: false,
        message: 'Error occurred while sending email',
        error: error.message,
      };
    }
  }

  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto) {
    try {
      this.logger.log(
        `Testing sendVerificationCode to: ${dto.toEmail}, type: ${dto.type}`,
      );
      const result = await this.mailService.sendVerificationCode(
        dto.toEmail,
        dto.verificationCode,
        dto.type,
        dto.username,
        dto.language,
      );

      return {
        success: result,
        message: result
          ? 'Verification code email sent successfully'
          : 'Failed to send verification code email',
        data: {
          to: dto.toEmail,
          type: dto.type,
          code: dto.verificationCode,
          language: dto.language || 'tr',
        },
      };
    } catch (error: any) {
      this.logger.error('Error in sendVerificationCode test:', error);
      return {
        success: false,
        message: 'Error occurred while sending verification code email',
        error: error.message,
      };
    }
  }

  @Post('send-welcome-email')
  @HttpCode(HttpStatus.OK)
  async sendWelcomeEmail(@Body() dto: SendWelcomeEmailDto) {
    try {
      this.logger.log(`Testing sendWelcomeEmail to: ${dto.toEmail}`);
      const result = await this.mailService.sendWelcomeEmail(
        dto.toEmail,
        dto.username,
        dto.language,
      );

      return {
        success: result,
        message: result
          ? 'Welcome email sent successfully'
          : 'Failed to send welcome email',
        data: {
          to: dto.toEmail,
          username: dto.username,
          language: dto.language || 'tr',
        },
      };
    } catch (error: any) {
      this.logger.error('Error in sendWelcomeEmail test:', error);
      return {
        success: false,
        message: 'Error occurred while sending welcome email',
        error: error.message,
      };
    }
  }

  @Post('send-notification-email')
  @HttpCode(HttpStatus.OK)
  async sendNotificationEmail(@Body() dto: SendNotificationEmailDto) {
    try {
      this.logger.log(`Testing sendNotificationEmail to: ${dto.toEmail}`);
      const result = await this.mailService.sendNotificationEmail(
        dto.toEmail,
        dto.username,
        dto.title,
        dto.message,
        dto.language,
      );

      return {
        success: result,
        message: result
          ? 'Notification email sent successfully'
          : 'Failed to send notification email',
        data: {
          to: dto.toEmail,
          username: dto.username,
          title: dto.title,
          message: dto.message,
          language: dto.language || 'tr',
        },
      };
    } catch (error: any) {
      this.logger.error('Error in sendNotificationEmail test:', error);
      return {
        success: false,
        message: 'Error occurred while sending notification email',
        error: error.message,
      };
    }
  }

  @Post('send-payment-success-email')
  @HttpCode(HttpStatus.OK)
  async sendPaymentSuccessEmail(@Body() dto: SendPaymentEmailDto) {
    try {
      this.logger.log(`Testing sendPaymentSuccessEmail to: ${dto.toEmail}`);
      const result = await this.mailService.sendPaymentSuccessEmail(
        dto.toEmail,
        dto.username,
        dto.amount,
        dto.currency,
        dto.transactionId,
        dto.language,
      );

      return {
        success: result,
        message: result
          ? 'Payment success email sent successfully'
          : 'Failed to send payment success email',
        data: {
          to: dto.toEmail,
          username: dto.username,
          amount: dto.amount,
          currency: dto.currency,
          transactionId: dto.transactionId,
          language: dto.language || 'tr',
        },
      };
    } catch (error: any) {
      this.logger.error('Error in sendPaymentSuccessEmail test:', error);
      return {
        success: false,
        message: 'Error occurred while sending payment success email',
        error: error.message,
      };
    }
  }

  @Post('send-payment-failed-email')
  @HttpCode(HttpStatus.OK)
  async sendPaymentFailedEmail(@Body() dto: SendPaymentFailedEmailDto) {
    try {
      this.logger.log(`Testing sendPaymentFailedEmail to: ${dto.toEmail}`);
      const result = await this.mailService.sendPaymentFailedEmail(
        dto.toEmail,
        dto.username,
        dto.amount,
        dto.currency,
        dto.errorMessage,
        dto.language,
      );

      return {
        success: result,
        message: result
          ? 'Payment failed email sent successfully'
          : 'Failed to send payment failed email',
        data: {
          to: dto.toEmail,
          username: dto.username,
          amount: dto.amount,
          currency: dto.currency,
          errorMessage: dto.errorMessage,
          language: dto.language || 'tr',
        },
      };
    } catch (error: any) {
      this.logger.error('Error in sendPaymentFailedEmail test:', error);
      return {
        success: false,
        message: 'Error occurred while sending payment failed email',
        error: error.message,
      };
    }
  }

  @Post('send-upload-success-email')
  @HttpCode(HttpStatus.OK)
  async sendUploadSuccessEmail(@Body() dto: SendUploadEmailDto) {
    try {
      this.logger.log(`Testing sendUploadSuccessEmail to: ${dto.toEmail}`);
      const result = await this.mailService.sendUploadSuccessEmail(
        dto.toEmail,
        dto.username,
        dto.fileName,
        dto.fileType,
        dto.language,
      );

      return {
        success: result,
        message: result
          ? 'Upload success email sent successfully'
          : 'Failed to send upload success email',
        data: {
          to: dto.toEmail,
          username: dto.username,
          fileName: dto.fileName,
          fileType: dto.fileType,
          language: dto.language || 'tr',
        },
      };
    } catch (error: any) {
      this.logger.error('Error in sendUploadSuccessEmail test:', error);
      return {
        success: false,
        message: 'Error occurred while sending upload success email',
        error: error.message,
      };
    }
  }

  @Post('send-upload-failed-email')
  @HttpCode(HttpStatus.OK)
  async sendUploadFailedEmail(@Body() dto: SendUploadFailedEmailDto) {
    try {
      this.logger.log(`Testing sendUploadFailedEmail to: ${dto.toEmail}`);
      const result = await this.mailService.sendUploadFailedEmail(
        dto.toEmail,
        dto.username,
        dto.fileName,
        dto.errorMessage,
        dto.language,
      );

      return {
        success: result,
        message: result
          ? 'Upload failed email sent successfully'
          : 'Failed to send upload failed email',
        data: {
          to: dto.toEmail,
          username: dto.username,
          fileName: dto.fileName,
          errorMessage: dto.errorMessage,
          language: dto.language || 'tr',
        },
      };
    } catch (error: any) {
      this.logger.error('Error in sendUploadFailedEmail test:', error);
      return {
        success: false,
        message: 'Error occurred while sending upload failed email',
        error: error.message,
      };
    }
  }

  @Post('send-template-email')
  @HttpCode(HttpStatus.OK)
  async sendTemplateEmail(@Body() dto: SendTemplateEmailDto) {
    try {
      this.logger.log(
        `Testing sendTemplateEmail to: ${dto.to}, template: ${dto.template}`,
      );

      let payload: any;
      try {
        payload = JSON.parse(dto.payload);
      } catch {
        return {
          success: false,
          message: 'Invalid JSON payload',
          error: 'Payload must be a valid JSON string',
        };
      }

      const result = await this.mailService.sendTemplateEmail({
        to: dto.to,
        subject: dto.subject,
        template: dto.template,
        payload,
        language: dto.language,
      } as any);

      return {
        success: result,
        message: result
          ? 'Template email sent successfully'
          : 'Failed to send template email',
        data: {
          to: dto.to,
          template: dto.template,
          subject: dto.subject,
          language: dto.language || 'tr',
        },
      };
    } catch (error: any) {
      this.logger.error('Error in sendTemplateEmail test:', error);
      return {
        success: false,
        message: 'Error occurred while sending template email',
        error: error.message,
      };
    }
  }

  @Get('test-simple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Basit test e-postası gönder',
    description:
      'yildirimsamet051@gmail.com adresine basit bir test e-postası gönderir.',
  })
  @ApiResponse({ status: 200, description: 'Test e-postası gönderim sonucu' })
  async testSimpleEmail() {
    try {
      const testEmail = 'yildirimsamet051@gmail.com';
      const htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #333;">SMTP Test Email</h2>
            <p>Bu bir test e-postasıdır.</p>
            <p>SMTP yapılandırması başarıyla çalışıyor!</p>
            <p><strong>Gönderen:</strong> mail@cevahiryapicpm.com</p>
            <p><strong>Alıcı:</strong> ${testEmail}</p>
            <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">CPM Günlük Hedefler Takip Sistemi</p>
          </body>
        </html>
      `;
      const subject = 'SMTP Test Email - CPM Sistem';

      this.logger.log(`Sending test email to: ${testEmail}`);
      const result = await this.mailService.sendEmail(
        testEmail,
        htmlContent,
        subject,
      );

      return {
        success: result,
        message: result
          ? 'Test email sent successfully'
          : 'Failed to send test email',
        data: {
          to: testEmail,
          subject: subject,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      this.logger.error('Error in testSimpleEmail:', error);
      return {
        success: false,
        message: 'Error occurred while sending test email',
        error: error.message,
      };
    }
  }
}

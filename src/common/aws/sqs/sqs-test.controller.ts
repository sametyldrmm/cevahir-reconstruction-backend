import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { SqsService } from './sqs.service';
import { SqsListenerService } from './sqs-listener.service';
import { ConfigService } from '@nestjs/config';
import { SendMessageDto, SendAnlikGpsMessageDto } from './dto/send-message.dto';

@ApiTags('SQS Test')
@ApiBearerAuth('JWT-auth')
@Controller('sqs-test')
export class SqsTestController {
  private readonly queueUrl: string;
  private readonly logger = new Logger(SqsTestController.name);

  constructor(
    private readonly sqsService: SqsService,
    private readonly sqsListenerService: SqsListenerService,
    private readonly configService: ConfigService,
  ) {
    let queueUrl = this.configService.get<string>('SQS_QUEUE_URL');
    const queueArn = this.configService.get<string>('SQS_QUEUE_ARN');

    // Eğer ARN verilmişse URL'e çevir
    if (queueArn && !queueUrl) {
      queueUrl = this.convertArnToUrl(queueArn);
    }

    // Default queue URL
    this.queueUrl =
      queueUrl ||
      'https://sqs.eu-central-1.amazonaws.com/097352008757/arac-takip.fifo';
  }

  /**
   * ARN'dan URL oluşturur
   */
  private convertArnToUrl(arn: string): string {
    const parts = arn.split(':');
    if (parts.length < 6 || parts[0] !== 'arn' || parts[2] !== 'sqs') {
      throw new Error(`Geçersiz SQS ARN formatı: ${arn}`);
    }

    const region = parts[3];
    const accountId = parts[4];
    const queueName = parts.slice(5).join(':');

    return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
  }

  /**
   * SQS kuyruğuna test mesajı gönder
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'SQS kuyruğuna test mesajı gönder',
    description:
      'SQS FIFO kuyruğuna test mesajı gönderir. Access denied hatası alırsanız AWS credentials kontrol edin.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'object',
          description:
            'Gönderilecek mesaj (opsiyonel, default test mesajı kullanılır)',
        },
        messageGroupId: {
          type: 'string',
          description:
            'FIFO queue için message group ID (opsiyonel, default: testarac)',
        },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Mesaj başarıyla gönderildi',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        messageId: { type: 'string' },
        queueUrl: { type: 'string' },
        sentMessage: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Hata durumu (success: false)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string' },
        queueUrl: { type: 'string' },
      },
    },
  })
  async sendTestMessage(
    @Body('message') message?: any,
    @Body('messageGroupId') messageGroupId?: string,
  ) {
    try {
      const testMessage = message || {
        type: 'test',
        timestamp: new Date().toISOString(),
        message: 'Bu bir test mesajıdır',
        data: {
          test: true,
          source: 'sqs-test-endpoint',
        },
      };

      // FIFO queue için messageGroupId zorunlu
      const sendOptions = {
        messageGroupId: messageGroupId || 'testarac',
        // MessageDeduplicationId otomatik oluşturulacak (ContentBasedDeduplication kapalıysa gerekli)
      };

      this.logger.log(`Mesaj gönderiliyor: ${this.queueUrl}`);
      this.logger.log(`MessageGroupId: ${sendOptions.messageGroupId}`);

      const result = await this.sqsService.sendMessage(
        this.queueUrl,
        testMessage,
        undefined,
        sendOptions,
      );

      return {
        success: true,
        message: 'Test mesajı gönderildi',
        messageId: result.MessageId,
        queueUrl: this.queueUrl,
        sentMessage: testMessage,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Bilinmeyen hata';
      const errorCode = error.code || error.Code;
      const isAccessDenied =
        errorMessage.includes('AccessDenied') ||
        errorMessage.includes('access denied') ||
        errorCode === 'AccessDenied';

      return {
        success: false,
        error: errorMessage,
        errorCode,
        queueUrl: this.queueUrl,
        ...(isAccessDenied && {
          hint: "AWS credentials kontrol edin. AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY ve AWS_REGION environment variable'larını kontrol edin.",
        }),
      };
    }
  }

  /**
   * EventBridge formatında test mesajı gönder
   */
  @Post('send-eventbridge-format')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'EventBridge formatında test mesajı gönder',
    description: 'EventBridge event formatında SQS kuyruğuna mesaj gönderir',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        detailType: {
          type: 'string',
          description: 'Event detail type',
          example: 'Test Event',
        },
        detail: {
          type: 'object',
          description: 'Event detail object',
        },
        messageGroupId: {
          type: 'string',
          description: 'FIFO queue için message group ID',
        },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'EventBridge formatında mesaj başarıyla gönderildi',
  })
  @HttpCode(HttpStatus.OK)
  async sendEventBridgeFormatMessage(
    @Body('detailType') detailType?: string,
    @Body('detail') detail?: any,
    @Body('messageGroupId') messageGroupId?: string,
  ) {
    try {
      const eventBridgeMessage = {
        version: '0',
        id: `test-${Date.now()}`,
        'detail-type': detailType || 'Test Event',
        source: 'com.cevahir.test',
        account: this.configService.get<string>(
          'AWS_ACCOUNT_ID',
          '097352008757',
        ),
        time: new Date().toISOString(),
        region: this.configService.get<string>('AWS_REGION', 'eu-central-1'),
        resources: [],
        detail: detail || {
          type: 'test-event',
          message: 'EventBridge formatında test mesajı',
          timestamp: new Date().toISOString(),
        },
      };

      const sendOptions = {
        messageGroupId: messageGroupId || 'eventbridge-group',
      };

      this.logger.log(
        `EventBridge formatında mesaj gönderiliyor: ${this.queueUrl}`,
      );

      const result = await this.sqsService.sendMessage(
        this.queueUrl,
        eventBridgeMessage,
        undefined,
        sendOptions,
      );

      return {
        success: true,
        message: 'EventBridge formatında test mesajı gönderildi',
        messageId: result.MessageId,
        queueUrl: this.queueUrl,
        sentMessage: eventBridgeMessage,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Bilinmeyen hata';
      const errorCode = error.code || error.Code;
      const isAccessDenied =
        errorMessage.includes('AccessDenied') ||
        errorMessage.includes('access denied') ||
        errorCode === 'AccessDenied';

      return {
        success: false,
        error: errorMessage,
        errorCode,
        queueUrl: this.queueUrl,
        ...(isAccessDenied && {
          hint: 'AWS credentials kontrol edin.',
        }),
      };
    }
  }

  /**
   * Toplantı hatırlatması test mesajı gönder
   */
  @Post('send-meeting-reminder')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Toplantı hatırlatması test mesajı gönder',
    description:
      'Toplantı hatırlatması için örnek mesaj gönderir (5 dakika önce hatırlatma)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        meetingTime: {
          type: 'string',
          format: 'date-time',
          description: 'Toplantı zamanı (ISO 8601)',
        },
        userId: {
          type: 'string',
          description: 'Kullanıcı ID',
        },
        messageGroupId: {
          type: 'string',
          description: 'FIFO queue için message group ID',
        },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Toplantı hatırlatması mesajı başarıyla gönderildi',
  })
  @HttpCode(HttpStatus.OK)
  async sendMeetingReminderMessage(
    @Body('meetingTime') meetingTime?: string,
    @Body('userId') userId?: string,
    @Body('messageGroupId') messageGroupId?: string,
  ) {
    try {
      const meetingReminderMessage = {
        type: 'meeting-reminder',
        meetingTime:
          meetingTime || new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 dakika sonra
        userId: userId || 'test-user',
        reminderMinutes: 5,
        timestamp: new Date().toISOString(),
        detail: {
          action: 'send-email',
          subject: 'Toplantı Hatırlatması',
          message: 'Toplantınız 5 dakika içinde başlayacak',
        },
      };

      const sendOptions = {
        messageGroupId: messageGroupId || 'meeting-reminder-group',
      };

      this.logger.log(
        `Toplantı hatırlatması mesajı gönderiliyor: ${this.queueUrl}`,
      );

      const result = await this.sqsService.sendMessage(
        this.queueUrl,
        meetingReminderMessage,
        undefined,
        sendOptions,
      );

      return {
        success: true,
        message: 'Toplantı hatırlatması test mesajı gönderildi',
        messageId: result.MessageId,
        queueUrl: this.queueUrl,
        sentMessage: meetingReminderMessage,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Bilinmeyen hata';
      const errorCode = error.code || error.Code;
      const isAccessDenied =
        errorMessage.includes('AccessDenied') ||
        errorMessage.includes('access denied') ||
        errorCode === 'AccessDenied';

      return {
        success: false,
        error: errorMessage,
        errorCode,
        queueUrl: this.queueUrl,
        ...(isAccessDenied && {
          hint: 'AWS credentials kontrol edin.',
        }),
      };
    }
  }

  /**
   * Listener durumunu kontrol et
   */
  @Get('listener-status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'SQS listener durumunu kontrol et',
    description: "SQS queue listener'ın çalışıp çalışmadığını kontrol eder",
  })
  @ApiResponse({
    status: 200,
    description: 'Listener durumu',
    schema: {
      type: 'object',
      properties: {
        isRunning: { type: 'boolean' },
        queueUrl: { type: 'string' },
      },
    },
  })
  async getListenerStatus() {
    return {
      isRunning: this.sqsListenerService.isRunning(),
      queueUrl: this.queueUrl,
    };
  }

  /**
   * Queue bilgilerini getir
   */
  @Get('queue-info')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'SQS queue bilgilerini getir',
    description: 'Kullanılan SQS queue hakkında bilgi döner',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue bilgileri',
    schema: {
      type: 'object',
      properties: {
        queueUrl: { type: 'string' },
        isFifoQueue: { type: 'boolean' },
        region: { type: 'string' },
      },
    },
  })
  async getQueueInfo() {
    return {
      queueUrl: this.queueUrl,
      isFifoQueue: this.queueUrl.endsWith('.fifo'),
      region: this.queueUrl.includes('eu-central-1')
        ? 'eu-central-1'
        : 'unknown',
    };
  }
}

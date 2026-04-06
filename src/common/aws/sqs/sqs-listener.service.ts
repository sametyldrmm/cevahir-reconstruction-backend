import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SqsService } from './sqs.service';
import { SQS } from 'aws-sdk';

@Injectable()
export class SqsListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsListenerService.name);
  private isListening = false;
  private stopListener: (() => void) | null = null;

  constructor(
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Modül başlatıldığında SQS queue'yu dinlemeye başla
   */
  async onModuleInit() {
    let queueUrl = this.configService.get<string>('SQS_QUEUE_URL');
    const queueArn = this.configService.get<string>('SQS_QUEUE_ARN');

    if (queueArn && !queueUrl) {
      queueUrl = this.convertArnToUrl(queueArn);
    }
    if (!queueUrl) {
      queueUrl =
        'https://sqs.eu-central-1.amazonaws.com/097352008757/arac-takip.fifo';
    }

    if (queueUrl) {
      await this.startListening(queueUrl);
      this.logger.log(`SQS listener ready: ${queueUrl.split('/').pop() ?? queueUrl}`);
    } else {
      this.logger.warn('SQS_QUEUE_URL/ARN not set, listener not started');
    }
  }

  /**
   * ARN'dan URL oluşturur
   * Format: arn:aws:sqs:REGION:ACCOUNT_ID:QUEUE_NAME
   */
  private convertArnToUrl(arn: string): string {
    // arn:aws:sqs:eu-central-1:097352008757:arac-takip.fifo
    const parts = arn.split(':');
    if (parts.length < 6 || parts[0] !== 'arn' || parts[2] !== 'sqs') {
      throw new Error(`Geçersiz SQS ARN formatı: ${arn}`);
    }

    const region = parts[3];
    const accountId = parts[4];
    const queueName = parts.slice(5).join(':'); // Queue name'de : olabilir

    return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
  }

  /**
   * Modül durdurulduğunda listener'ı durdur
   */
  async onModuleDestroy() {
    if (this.stopListener) {
      this.logger.log('SQS listener durduruluyor...');
      this.stopListener();
      this.isListening = false;
    }
  }

  /**
   * SQS queue'yu dinlemeye başla
   * @param queueUrl SQS queue URL'i
   */
  async startListening(queueUrl: string): Promise<void> {
    if (this.isListening) {
      this.logger.warn('SQS listener already running');
      return;
    }

    const messageHandler = async (message: SQS.Message) => {
      try {
        this.logger.debug(`SQS message processed: ${message.MessageId}`);
      } catch (error: any) {
        this.logger.error(`SQS message ${message.MessageId} error: ${error.message}`);
      }
    };

    // FIFO queue için özel ayarlar
    const isFifoQueue = queueUrl.endsWith('.fifo');

    // Listener'ı başlat
    this.stopListener = await this.sqsService.startMessageProcessor(
      queueUrl,
      messageHandler,
      {
        maxMessages: isFifoQueue ? 10 : 10, // FIFO queue'lar için max 10
        waitTimeSeconds: 5, // Long polling
        pollingIntervalMs: 0, // Hemen devam et
        autoDelete: true, // Mesajı işledikten sonra sil
      },
    );

    this.isListening = true;
  }

  /**
   * Listener'ı durdur
   */
  stop(): void {
    if (this.stopListener) {
      this.stopListener();
      this.stopListener = null;
      this.isListening = false;
      this.logger.log('SQS listener durduruldu');
    }
  }

  /**
   * Listener durumunu kontrol et
   */
  isRunning(): boolean {
    return this.isListening;
  }
}

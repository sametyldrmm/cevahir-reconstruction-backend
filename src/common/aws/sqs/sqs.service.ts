import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQS } from 'aws-sdk';
import { AwsClientFactory } from '../common/aws-client.factory';

@Injectable()
export class SqsService {
  private readonly sqs: SQS;
  private readonly logger = new Logger(SqsService.name);

  constructor(
    private readonly awsClientFactory: AwsClientFactory,
    private readonly configService: ConfigService,
  ) {
    this.sqs = this.awsClientFactory.createSQSClient();
  }

  async sendMessage(
    queueUrl: string,
    messageBody: any,
    messageAttributes?: Record<string, SQS.MessageAttributeValue>,
    options?: {
      messageGroupId?: string; // FIFO queue için
      messageDeduplicationId?: string; // FIFO queue için
    },
  ): Promise<SQS.SendMessageResult> {
    try {
      const isFifoQueue = queueUrl.endsWith('.fifo');

      const params: SQS.SendMessageRequest = {
        QueueUrl: queueUrl,
        MessageBody:
          typeof messageBody === 'string'
            ? messageBody
            : JSON.stringify(messageBody),
      };

      if (messageAttributes) {
        params.MessageAttributes = messageAttributes;
      }

      // FIFO queue için özel parametreler
      if (isFifoQueue) {
        // MessageGroupId zorunlu
        if (options?.messageGroupId) {
          params.MessageGroupId = options.messageGroupId;
        } else {
          // Default message group ID
          params.MessageGroupId = 'default';
        }

        // MessageDeduplicationId - ContentBasedDeduplication kapalıysa zorunlu
        // Eğer ContentBasedDeduplication açıksa, MessageDeduplicationId göndermemeliyiz
        // Şimdilik her zaman gönderiyoruz, eğer InvalidParameterValue hatası alırsak
        // ContentBasedDeduplication açık demektir ve bu parametreyi kaldırmalıyız
        if (options?.messageDeduplicationId !== undefined) {
          // Explicit olarak verilmişse kullan
          params.MessageDeduplicationId = options.messageDeduplicationId;
        } else if (options?.messageDeduplicationId === null) {
          // Explicit olarak null verilmişse gönderme (ContentBasedDeduplication açık)
          // params.MessageDeduplicationId eklenmeyecek
        } else {
          // Otomatik deduplication ID oluştur
          // Not: Eğer InvalidParameterValue hatası alırsanız, ContentBasedDeduplication açık demektir
          // ve bu satırı kaldırıp tekrar deneyin
          params.MessageDeduplicationId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        }
      }

      this.logger.debug(`SQS mesajı gönderiliyor: ${queueUrl}`);
      this.logger.debug(`FIFO Queue: ${isFifoQueue}`);
      if (isFifoQueue) {
        this.logger.debug(`MessageGroupId: ${params.MessageGroupId}`);
        this.logger.debug(
          `MessageDeduplicationId: ${params.MessageDeduplicationId}`,
        );
      }

      const result = await this.sqs.sendMessage(params).promise();
      this.logger.log(
        `Mesaj başarıyla gönderildi, MessageId: ${result.MessageId}`,
      );
      return result;
    } catch (error: any) {
      const errorCode = error.code || error.Code || 'Unknown';
      const errorMessage = error.message || 'Bilinmeyen hata';
      const requestId = error.requestId || error.RequestId || 'N/A';

      this.logger.error('='.repeat(80));
      this.logger.error('SQS MESAJ GÖNDERME HATASI');
      this.logger.error('='.repeat(80));
      this.logger.error(`Queue URL: ${queueUrl}`);
      this.logger.error(`Error Code: ${errorCode}`);
      this.logger.error(`Error Message: ${errorMessage}`);
      this.logger.error(`Request ID: ${requestId}`);

      if (error.statusCode) {
        this.logger.error(`Status Code: ${error.statusCode}`);
      }

      if (error.retryable !== undefined) {
        this.logger.error(`Retryable: ${error.retryable}`);
      }

      // Özel hata mesajları
      if (errorCode === 'InvalidParameterValue') {
        this.logger.error(
          'HINT: FIFO queue için MessageGroupId veya MessageDeduplicationId parametrelerini kontrol edin.',
        );
      } else if (errorCode === 'AccessDenied') {
        this.logger.error(
          'HINT: AWS credentials ve IAM permissions kontrol edin.',
        );
        this.logger.error('   Gerekli permission: sqs:SendMessage');
      } else if (errorCode === 'AWS.SimpleQueueService.NonExistentQueue') {
        this.logger.error(
          "HINT: Queue bulunamadı. Queue URL'ini kontrol edin.",
        );
      }

      this.logger.error('='.repeat(80));

      if (error.stack) {
        this.logger.error('Stack Trace:');
        this.logger.error(error.stack);
      }

      throw error;
    }
  }

  async receiveMessages(
    queueUrl: string,
    maxMessages = 10,
    waitTimeSeconds = 20,
  ): Promise<SQS.Message[]> {
    try {
      const params: SQS.ReceiveMessageRequest = {
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: waitTimeSeconds,
        AttributeNames: ['All'],
        MessageAttributeNames: ['All'],
      };

      const result = await this.sqs.receiveMessage(params).promise();
      const messages = result.Messages || [];
      if (messages.length > 0) {
        this.logger.debug(`SQS received ${messages.length} messages`);
      }
      return messages;
    } catch (error: any) {
      this.logger.error(
        `SQS mesajları alınırken hata oluştu: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
    try {
      const params: SQS.DeleteMessageRequest = {
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      };

      await this.sqs.deleteMessage(params).promise();
      this.logger.debug(`SQS message deleted`);
    } catch (error: any) {
      this.logger.error(
        `SQS mesajı silinirken hata oluştu: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async createQueue(
    queueName: string,
    attributes?: Record<string, string>,
  ): Promise<string> {
    try {
      const params: SQS.CreateQueueRequest = {
        QueueName: queueName,
        Attributes: attributes || {},
      };

      const result = await this.sqs.createQueue(params).promise();
      this.logger.debug(`Kuyruk oluşturuldu, URL: ${result.QueueUrl}`);
      return result.QueueUrl!;
    } catch (error: any) {
      this.logger.error(
        `SQS kuyruğu oluşturulurken hata oluştu: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getQueueUrl(queueName: string): Promise<string> {
    try {
      const params: SQS.GetQueueUrlRequest = {
        QueueName: queueName,
      };

      const result = await this.sqs.getQueueUrl(params).promise();
      return result.QueueUrl!;
    } catch (error: any) {
      this.logger.error(
        `SQS kuyruk URL'si alınırken hata oluştu: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async startMessageProcessor(
    queueUrl: string,
    handler: (message: SQS.Message) => Promise<void>,
    options: {
      maxMessages?: number;
      waitTimeSeconds?: number;
      pollingIntervalMs?: number;
      autoDelete?: boolean;
    } = {},
  ): Promise<() => void> {
    const {
      maxMessages = 10,
      waitTimeSeconds = 20,
      pollingIntervalMs = 0,
      autoDelete = true,
    } = options;

    let isRunning = true;

    const processMessages = async () => {
      if (!isRunning) {
        this.logger.log(
          '🛑 Message processor durduruldu, polling durduruluyor...',
        );
        return;
      }

      try {
        this.logger.debug(
          `🔍 SQS queue'dan mesaj bekleniyor... (Queue: ${queueUrl.split('/').pop()})`,
        );

        const messages = await this.receiveMessages(
          queueUrl,
          maxMessages,
          waitTimeSeconds,
        );

        if (messages.length === 0) {
          // Mesaj gelmedi - boş polling
          this.logger.debug(
            `⏳ Mesaj gelmedi (Long polling: ${waitTimeSeconds}s), tekrar denenecek...`,
          );
        } else {
          this.logger.debug(`SQS ${messages.length} mesaj işleniyor`);
        }

        for (const message of messages) {
          try {
            await handler(message);

            if (autoDelete) {
              await this.deleteMessage(queueUrl, message.ReceiptHandle!);
            }
          } catch (error: any) {
            this.logger.error(`SQS message ${message.MessageId} handler error: ${error.message}`);
          }
        }

        if (pollingIntervalMs > 0) {
          setTimeout(processMessages, pollingIntervalMs);
        } else {
          setImmediate(processMessages);
        }
      } catch (error: any) {
        this.logger.error(`SQS processor error: ${error.message}, retry in 5s`);
        setTimeout(processMessages, 5000);
      }
    };

    processMessages();

    return () => {
      isRunning = false;
    };
  }
}

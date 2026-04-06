import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';

@Injectable()
export class AwsClientFactory {
  constructor() {
    // Ortam değişkenlerini loglamak istersen burada bırakabilirsin
    // console.log('AWS_REGION', process.env.AWS_REGION);
    // console.log('AWS_ACCESS_KEY_ID', process.env.AWS_ACCESS_KEY_ID);
    // console.log('AWS_SECRET_ACCESS_KEY', process.env.AWS_SECRET_ACCESS_KEY);
  }

  createS3Client(): AWS.S3 {
    return new AWS.S3({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  createCloudFrontClient(): AWS.CloudFront {
    return new AWS.CloudFront({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  createSQSClient(): AWS.SQS {
    return new AWS.SQS({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  createSESClient(): AWS.SES {
    return new AWS.SES({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  createEventBridgeClient(): AWS.EventBridge {
    return new AWS.EventBridge({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  createEventBridgeSchedulerClient(): AWS.EventBridge {
    // EventBridge Scheduler API'si için özel endpoint
    // AWS SDK v2'de Scheduler için ayrı client yok, EventBridge client'ını kullanıyoruz
    // ama endpoint'i scheduler endpoint'ine yönlendirebiliriz
    const region = process.env.AWS_REGION || 'us-east-1';
    const client = new AWS.EventBridge({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    // Scheduler API endpoint'ini ayarla
    // EventBridge Scheduler API endpoint: scheduler.{region}.amazonaws.com
    // Ancak AWS SDK v2'de bu otomatik olarak yapılıyor, sadece service name'i değiştirmemiz gerekiyor
    // Şimdilik normal EventBridge client kullanacağız, Scheduler API metodlarını manuel olarak çağıracağız
    return client;
  }
}

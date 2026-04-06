import { Injectable, OnModuleInit } from '@nestjs/common';
import { S3, SQS } from 'aws-sdk';
import { ConfigService } from '@nestjs/config';
import { AwsClientFactory } from '../common/aws-client.factory';
import { CleanLogger } from '../../logger';

@Injectable()
export class S3ListenerService implements OnModuleInit {
  private readonly logger = new CleanLogger(S3ListenerService.name);
  private readonly s3: S3;
  // private readonly sqs: SQS;
  // private readonly queueUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly awsClientFactory: AwsClientFactory,
  ) {
    this.s3 = this.awsClientFactory.createS3Client();

    const awsRegion = process.env.AWS_REGION;
    const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

    // S3 client is already created via factory; below is kept as example config

    new S3({
      region: awsRegion,
      accessKeyId: awsAccessKey,
      secretAccessKey: awsSecretKey,
    });

    // SQS örnek kodu yorumlu bırakıldı
    // this.sqs = new SQS({
    //   region: awsRegion,
    //   accessKeyId: awsAccessKey,
    //   secretAccessKey: awsSecretKey,
    // });
  }

  async onModuleInit() {
    // Dinleme mekanizmasını burada başlatmak istersen açabilirsin
    // await this.startListening();
  }

  // private async startListening() {
  //   ...
  // }

  private async processMessage(message: SQS.Message) {
    const event = JSON.parse(message.Body || '');
    const record = event.Records[0];

    if (record.eventName.startsWith('ObjectCreated:')) {
      const bucket = record.s3.bucket.name;
      const key = record.s3.object.key;

      this.logger.log(`Yeni dosya yüklendi: ${key}, Bucket: ${bucket}`);
    }
  }
}


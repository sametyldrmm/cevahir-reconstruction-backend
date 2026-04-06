import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';

@Injectable()
export class CloudfrontService {
  private readonly cloudfront: AWS.CloudFront;
  private readonly logger = new Logger(CloudfrontService.name);

  constructor(private readonly configService: ConfigService) {
    const awsRegion = this.configService.get<string>('AWS_REGION');
    const awsAccessKey = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecretKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.logger.debug('AWS CloudFront Configuration');
    this.logger.debug(`AWS_REGION: ${awsRegion}`);
    this.logger.debug(
      `AWS_ACCESS_KEY_ID: ${
        awsAccessKey ? `${awsAccessKey.substring(0, 4)}****` : 'NOT_SET'
      }`,
    );
    this.logger.debug(
      `AWS_SECRET_ACCESS_KEY: ${awsSecretKey ? '****' : 'NOT_SET'}`,
    );

    this.cloudfront = new AWS.CloudFront({
      region: awsRegion || '',
      credentials: {
        accessKeyId: awsAccessKey || '',
        secretAccessKey: awsSecretKey || '',
      },
    });
  }

  // CloudFront ile ilgili metodları burada tanımlayabilirsin
}


import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from './s3.service';
import { S3ListenerService } from './s3-listener.service';
import { AwsClientFactory } from '../common/aws-client.factory';

@Module({
  imports: [ConfigModule],
  providers: [S3Service, S3ListenerService, AwsClientFactory],
  exports: [S3Service, S3ListenerService],
})
export class S3Module {}


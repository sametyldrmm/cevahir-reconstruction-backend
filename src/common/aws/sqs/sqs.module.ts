import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SqsService } from './sqs.service';
import { SqsListenerService } from './sqs-listener.service';
import { SqsTestController } from './sqs-test.controller';
import { AwsClientFactory } from '../common/aws-client.factory';

@Module({
  imports: [ConfigModule],
  controllers: [SqsTestController],
  providers: [SqsService, SqsListenerService, AwsClientFactory],
  exports: [SqsService, SqsListenerService],
})
export class SqsModule {}

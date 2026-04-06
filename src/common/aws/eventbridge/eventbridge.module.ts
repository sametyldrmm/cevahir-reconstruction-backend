import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventBridgeSchedulerService } from './eventbridge-scheduler.service';
import { EventBridgeCronService } from './eventbridge-cron.service';
import { EventBridgeController } from './eventbridge.controller';
import { AwsClientFactory } from '../common/aws-client.factory';

@Module({
  imports: [ConfigModule],
  controllers: [EventBridgeController],
  providers: [
    EventBridgeSchedulerService,
    EventBridgeCronService,
    AwsClientFactory,
  ],
  exports: [EventBridgeSchedulerService, EventBridgeCronService],
})
export class EventBridgeModule {}

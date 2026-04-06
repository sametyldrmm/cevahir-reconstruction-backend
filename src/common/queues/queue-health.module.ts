import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisConnectionService } from './redis-connection.service';
import { QueueHealthController } from './queue-health.controller';

@Module({
  imports: [ConfigModule],
  controllers: [QueueHealthController],
  providers: [RedisConnectionService],
  exports: [RedisConnectionService],
})
export class QueueHealthModule {}

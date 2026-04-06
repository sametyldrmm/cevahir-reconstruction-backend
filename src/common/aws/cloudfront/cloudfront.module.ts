import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudfrontService } from './cloudfront.service';

@Module({
  imports: [ConfigModule],
  providers: [CloudfrontService],
  exports: [CloudfrontService],
})
export class CloudfrontModule {}


import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from '../access/access.module';
import { ProgressController } from './progress.controller';
import { ProgressDataService } from './progress-data.service';
import { ProgressFilterService } from './progress-filter.service';

@Module({
  imports: [ConfigModule, AccessModule],
  controllers: [ProgressController],
  providers: [ProgressDataService, ProgressFilterService],
  exports: [ProgressDataService, ProgressFilterService],
})
export class ProgressModule {}

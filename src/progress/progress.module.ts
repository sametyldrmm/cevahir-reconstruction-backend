import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { CommonJwtModule } from '../common/jwt/jwt.module';
import { ProgressController } from './progress.controller';
import { ProgressDataService } from './progress-data.service';
import { ProgressFilterService } from './progress-filter.service';
import { ProjectProgressBlock } from './entities/project-progress-block.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ProjectProgressBlock]),
    AccessModule,
    CommonJwtModule,
  ],
  controllers: [ProgressController],
  providers: [ProgressDataService, ProgressFilterService],
  exports: [ProgressDataService, ProgressFilterService],
})
export class ProgressModule {}

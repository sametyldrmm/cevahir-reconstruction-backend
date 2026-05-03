import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonJwtModule } from '../common/jwt/jwt.module';
import { S3Module } from '../common/aws/s3/s3.module';
import { UploadSession } from './entities/upload-session.entity';
import { UploadsCleanupService } from './uploads-cleanup.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [TypeOrmModule.forFeature([UploadSession]), S3Module, CommonJwtModule],
  controllers: [UploadsController],
  providers: [UploadsService, UploadsCleanupService],
  exports: [UploadsService],
})
export class UploadsModule {}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UploadsService } from './uploads.service';

const UPLOADS_CLEANUP_CRON =
  process.env.UPLOADS_CLEANUP_CRON ?? CronExpression.EVERY_30_MINUTES;

@Injectable()
export class UploadsCleanupService {
  private readonly logger = new Logger(UploadsCleanupService.name);

  constructor(private readonly uploads: UploadsService) {}

  @Cron(UPLOADS_CLEANUP_CRON)
  async abortExpiredMultipartUploads() {
    const result = await this.uploads.abortExpiredSessions();

    if (result.abortedCount > 0) {
      this.logger.log(
        `Aborted ${result.abortedCount} stale multipart upload session(s)`,
      );
    } else {
      this.logger.debug('No stale multipart upload sessions found');
    }
  }
}

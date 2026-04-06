import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JobResult } from './queue.types';

/**
 * Base Queue Worker Service
 * Tüm queue worker servisleri için temel sınıf
 */
export abstract class BaseQueueWorkerService extends WorkerHost {
  protected readonly logger: Logger;

  constructor() {
    super();
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Ana job işleme metodu - Alt sınıflarda override edilmeli
   */
  abstract process(job: Job<any>): Promise<JobResult>;

  /**
   * Job işleme wrapper - Logging ve error handling için
   */
  protected async processJob(
    job: Job<any>,
    handler: (job: Job<any>) => Promise<any>,
  ): Promise<JobResult> {
    const startTime = Date.now();
    try {
      const result = await handler(job);
      const jobResult: JobResult = {
        success: true,
        data: result,
        processedAt: new Date(),
      };
      this.logger.debug(
        `Job ${job.id} (${job.name}) ok in ${Date.now() - startTime}ms`,
      );
      return jobResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Job ${job.id} failed after ${duration}ms:`, error);

      const jobResult: JobResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processedAt: new Date(),
      };

      throw jobResult;
    }
  }

  /**
   * Job progress güncelleme helper
   */
  protected async updateProgress(job: Job, progress: number) {
    try {
      await job.updateProgress(progress);
      this.logger.log(`Job ${job.id} progress: ${progress}%`);
    } catch (error) {
      this.logger.error(`Failed to update progress for job ${job.id}`, error);
    }
  }

  // Event Handlers
  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    const action = result?.data?.action ?? result?.action ?? 'ok';
    this.logger.log(`Job ${job.id} (${job.name}) done: ${action}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error?.message ?? error}`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(`Job ${job.id} progress: ${progress}%`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Job ${job.id} active`);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Job ${jobId} has stalled`);
  }

  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error('Worker error:', error);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BaseJobData, JobResult } from './queue.types';

/**
 * Base Queue Producer Service
 * Tüm queue producer servisleri için temel sınıf
 */
@Injectable()
export abstract class BaseQueueProducerService {
  protected readonly logger: Logger;

  constructor(protected readonly queue: Queue) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Genel job ekleme metodu
   */
  async addJob<T extends BaseJobData>(
    jobType: string,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      removeOnComplete?: number | boolean;
      removeOnFail?: number | boolean;
    },
  ) {
    try {
      // Priority'yi integer'a çevir (BullMQ float kabul etmiyor)
      const priority = Math.floor(options?.priority ?? data.priority ?? 0);

      const job = await this.queue.add(jobType, data, {
        priority,
        delay: options?.delay ?? 0,
        attempts: options?.attempts ?? 3,
        removeOnComplete: options?.removeOnComplete ?? 10,
        removeOnFail: options?.removeOnFail ?? 5,
        ...options,
      });

      this.logger.log(`Job added: ${jobType}, Job ID: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to add job: ${jobType}`, error);
      throw error;
    }
  }

  /**
   * Queue istatistikleri
   */
  async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed(),
      ]);

      return {
        queueName: this.queue.name,
        counts: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for ${this.queue.name}`, error);
      throw error;
    }
  }

  /**
   * Belirli bir job'ı al
   */
  async getJob(jobId: string) {
    try {
      return await this.queue.getJob(jobId);
    } catch (error) {
      this.logger.error(`Failed to get job: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * Job'ı iptal et
   */
  async removeJob(jobId: string) {
    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Job removed: ${jobId}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to remove job: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * Tüm bekleyen job'ları temizle
   */
  async cleanWaitingJobs(grace: number = 0) {
    try {
      const cleaned = await this.queue.clean(grace, 100, 'waiting');
      this.logger.log(`Cleaned ${cleaned.length} waiting jobs`);
      return cleaned;
    } catch (error) {
      this.logger.error('Failed to clean waiting jobs', error);
      throw error;
    }
  }

  /**
   * Tüm tamamlanan job'ları temizle
   */
  async cleanCompletedJobs(grace: number = 0) {
    try {
      const cleaned = await this.queue.clean(grace, 100, 'completed');
      this.logger.log(`Cleaned ${cleaned.length} completed jobs`);
      return cleaned;
    } catch (error) {
      this.logger.error('Failed to clean completed jobs', error);
      throw error;
    }
  }

  /**
   * Tüm başarısız job'ları temizle
   */
  async cleanFailedJobs(grace: number = 0) {
    try {
      const cleaned = await this.queue.clean(grace, 100, 'failed');
      this.logger.log(`Cleaned ${cleaned.length} failed jobs`);
      return cleaned;
    } catch (error) {
      this.logger.error('Failed to clean failed jobs', error);
      throw error;
    }
  }
}

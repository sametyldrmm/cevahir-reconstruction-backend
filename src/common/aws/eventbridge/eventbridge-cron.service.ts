import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBridgeSchedulerService } from './eventbridge-scheduler.service';

export interface CronJobConfig {
  ruleName: string;
  description?: string;
  cronExpression: string; // AWS EventBridge cron formatı (örn: "cron(0 9 * * ? *)" veya "rate(1 minute)")
  scheduleExpressionTimezone?: string; // IANA timezone (örn: "Europe/Istanbul")
  queueUrl: string;
  messageBody?: any;
  enabled?: boolean;
  scheduleGroupName?: string; // EventBridge Scheduler schedule group name (örn: "test")
}

/**
 * EventBridge ile cron job yönetimi için yardımcı servis
 * Cron job'ları EventBridge'de oluşturur ve SQS'ye mesaj gönderir
 */
@Injectable()
export class EventBridgeCronService {
  private readonly logger = new Logger(EventBridgeCronService.name);

  constructor(
    private readonly schedulerService: EventBridgeSchedulerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cron job oluşturur veya günceller (EventBridge Scheduler API kullanır)
   * @param config Cron job yapılandırması
   */
  async createOrUpdateCronJob(config: CronJobConfig): Promise<void> {
    try {
      const scheduleExpression = this.convertToEventBridgeCron(
        config.cronExpression,
      );
      const isCronExpression = scheduleExpression
        .trim()
        .toLowerCase()
        .startsWith('cron(');
      // Timezone: eğer belirtilmemişse ve cron expression ise, varsayılan olarak UTC+3 (Europe/Istanbul) kullan
      const scheduleExpressionTimezone = isCronExpression
        ? (config.scheduleExpressionTimezone || 'Europe/Istanbul')
        : undefined;

      // FIFO queue için MessageGroupId belirle
      const isFifoQueue = config.queueUrl.endsWith('.fifo');
      const messageGroupId = isFifoQueue
        ? `${config.ruleName}-group`
        : undefined;

      // Queue ARN'ini al
      const queueArn = this.getQueueArn(config.queueUrl);
      const roleArn =
        this.configService.get<string>('AWS_EVENTBRIDGE_ROLE_ARN') ||
        'arn:aws:iam::097352008757:role/service-role/Amazon_EventBridge_Scheduler_SQS_6d235f6626';

      // Target yapılandırması
      const target: any = {
        arn: queueArn,
        roleArn,
        ...(isFifoQueue && {
          sqsParameters: {
            MessageGroupId: messageGroupId,
          },
        }),
      };

      // Mesaj body varsa input olarak ekle
      if (config.messageBody) {
        target.input = JSON.stringify(config.messageBody);
      }

      // Önce schedule'ın var olup olmadığını kontrol et
      let scheduleExists = false;
      let existingSchedule: any = null;

      try {
        existingSchedule = await this.schedulerService.getSchedule(
          config.ruleName,
          config.scheduleGroupName,
        );
        scheduleExists = true;
      } catch (error: any) {
        // Schedule bulunamadı, yeni oluşturulacak
        if (
          error.name === 'ResourceNotFoundException' ||
          error.Code === 'ResourceNotFoundException' ||
          error.code === 'ResourceNotFoundException'
        ) {
          scheduleExists = false;
        } else {
          // Beklenmeyen bir hata, fırlat
          throw error;
        }
      }

      if (scheduleExists) {
        // Schedule zaten var, güncelle
        this.logger.log(
          `Schedule zaten mevcut, güncelleniyor: ${config.ruleName}`,
        );

        await this.schedulerService.updateSchedule({
          scheduleName: config.ruleName,
          scheduleExpression,
          state: config.enabled === false ? 'DISABLED' : 'ENABLED',
          scheduleGroupName:
            config.scheduleGroupName || existingSchedule.GroupName,
          description: config.description || existingSchedule.Description,
          scheduleExpressionTimezone:
            scheduleExpressionTimezone ??
            (isCronExpression
              ? existingSchedule.ScheduleExpressionTimezone
              : undefined),
          flexibleTimeWindow: existingSchedule.FlexibleTimeWindow || {
            mode: 'OFF',
          },
          target: {
            arn: target.arn,
            roleArn: target.roleArn,
            sqsParameters: target.sqsParameters,
            input: target.input,
          },
        });

        this.logger.log(`Cron job güncellendi: ${config.ruleName}`);
      } else {
        // Schedule yok, yeni oluştur
        this.logger.log(`Yeni schedule oluşturuluyor: ${config.ruleName}`);

        await this.schedulerService.createScheduleWithSqsTarget(
          config.ruleName,
          scheduleExpression,
          config.queueUrl,
          config.messageBody,
          config.description,
          config.scheduleGroupName,
          messageGroupId,
          scheduleExpressionTimezone,
        );

        // Eğer disabled olarak ayarlanmışsa, oluşturduktan sonra disable et
        if (config.enabled === false) {
          const schedule = await this.schedulerService.getSchedule(
            config.ruleName,
            config.scheduleGroupName,
          );

          await this.schedulerService.updateSchedule({
            scheduleName: config.ruleName,
            scheduleExpression: schedule.ScheduleExpression,
            state: 'DISABLED',
            scheduleGroupName: config.scheduleGroupName || schedule.GroupName,
            description: schedule.Description,
            scheduleExpressionTimezone: schedule.ScheduleExpressionTimezone,
            flexibleTimeWindow: schedule.FlexibleTimeWindow,
            target: {
              arn: schedule.Target.Arn,
              roleArn: schedule.Target.RoleArn,
              sqsParameters: schedule.Target.SqsParameters,
              input: schedule.Target.Input,
              inputTransformer: schedule.Target.InputTransformer,
            },
          });
        }

        this.logger.log(`Cron job oluşturuldu: ${config.ruleName}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Cron job oluşturulurken/güncellenirken hata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * SQS queue URL'inden ARN oluşturur
   */
  private getQueueArn(queueUrl: string): string {
    const urlParts = queueUrl.split('/');
    const queueName = urlParts[urlParts.length - 1];
    const accountIdMatch = queueUrl.match(/amazonaws\.com\/(\d+)\//);
    const accountId =
      accountIdMatch?.[1] ||
      this.configService.get<string>('AWS_ACCOUNT_ID') ||
      '';

    if (!accountId) {
      throw new Error(
        "AWS_ACCOUNT_ID environment variable tanımlı değil veya queue URL'den çıkarılamadı",
      );
    }

    // Region'ı URL'den çıkar veya config'den al
    const regionMatch = queueUrl.match(/sqs\.([^.]+)\.amazonaws\.com/);
    const region =
      regionMatch?.[1] ||
      this.configService.get<string>('AWS_REGION') ||
      'eu-central-1';
    return `arn:aws:sqs:${region}:${accountId}:${queueName}`;
  }

  /**
   * Birden fazla cron job oluşturur
   * @param configs Cron job yapılandırmaları
   */
  async createMultipleCronJobs(
    configs: CronJobConfig[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const config of configs) {
      try {
        await this.createOrUpdateCronJob(config);
        success++;
      } catch (error) {
        this.logger.error(`Cron job oluşturulamadı: ${config.ruleName}`, error);
        failed++;
      }
    }

    this.logger.log(
      `Cron job'lar oluşturuldu: ${success} başarılı, ${failed} başarısız`,
    );

    return { success, failed };
  }

  /**
   * Cron job'ı siler
   * @param scheduleName Schedule adı
   * @param scheduleGroupName Schedule group name (opsiyonel)
   */
  async deleteCronJob(
    scheduleName: string,
    scheduleGroupName?: string,
  ): Promise<void> {
    try {
      await this.schedulerService.deleteSchedule(
        scheduleName,
        scheduleGroupName,
      );
      this.logger.log(`Cron job silindi: ${scheduleName}`);
    } catch (error: any) {
      this.logger.error(
        `Cron job silinirken hata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cron job'ı devre dışı bırakır
   * @param scheduleName Schedule adı
   * @param scheduleGroupName Schedule group name (opsiyonel)
   */
  async disableCronJob(
    scheduleName: string,
    scheduleGroupName?: string,
  ): Promise<void> {
    try {
      // Schedule detaylarını al
      const schedule = await this.schedulerService.getSchedule(
        scheduleName,
        scheduleGroupName,
      );

      // State'i DISABLED olarak güncelle
      await this.schedulerService.updateSchedule({
        scheduleName,
        scheduleExpression: schedule.ScheduleExpression,
        state: 'DISABLED',
        scheduleGroupName: scheduleGroupName || schedule.GroupName,
        description: schedule.Description,
        scheduleExpressionTimezone: schedule.ScheduleExpressionTimezone,
        flexibleTimeWindow: schedule.FlexibleTimeWindow,
        target: {
          arn: schedule.Target.Arn,
          roleArn: schedule.Target.RoleArn,
          sqsParameters: schedule.Target.SqsParameters,
          input: schedule.Target.Input,
          inputTransformer: schedule.Target.InputTransformer,
        },
      });

      this.logger.log(`Cron job devre dışı bırakıldı: ${scheduleName}`);
    } catch (error: any) {
      this.logger.error(
        `Cron job devre dışı bırakılırken hata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cron job'ı etkinleştirir
   * @param scheduleName Schedule adı
   * @param scheduleGroupName Schedule group name (opsiyonel)
   */
  async enableCronJob(
    scheduleName: string,
    scheduleGroupName?: string,
  ): Promise<void> {
    try {
      // Schedule detaylarını al
      const schedule = await this.schedulerService.getSchedule(
        scheduleName,
        scheduleGroupName,
      );

      // State'i ENABLED olarak güncelle
      await this.schedulerService.updateSchedule({
        scheduleName,
        scheduleExpression: schedule.ScheduleExpression,
        state: 'ENABLED',
        scheduleGroupName: scheduleGroupName || schedule.GroupName,
        description: schedule.Description,
        scheduleExpressionTimezone: schedule.ScheduleExpressionTimezone,
        flexibleTimeWindow: schedule.FlexibleTimeWindow,
        target: {
          arn: schedule.Target.Arn,
          roleArn: schedule.Target.RoleArn,
          sqsParameters: schedule.Target.SqsParameters,
          input: schedule.Target.Input,
          inputTransformer: schedule.Target.InputTransformer,
        },
      });

      this.logger.log(`Cron job etkinleştirildi: ${scheduleName}`);
    } catch (error: any) {
      this.logger.error(
        `Cron job etkinleştirilirken hata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Tüm cron job'ları listeler
   * @param scheduleGroupName Schedule group name (opsiyonel) - Belirtilirse sadece o gruba ait schedule'lar listelenir
   */
  async listCronJobs(scheduleGroupName?: string) {
    try {
      const schedules = await this.schedulerService.listSchedules(
        scheduleGroupName,
        undefined, // namePrefix kaldırıldı, her zaman undefined
      );

      // Her schedule için detaylı bilgileri topla
      const jobsWithDetails = await Promise.all(
        schedules.map(async (schedule: any) => {
          const job: any = {
            scheduleName: schedule.Name,
            scheduleGroupName: schedule.GroupName,
            description: schedule.Description,
            scheduleExpression: schedule.ScheduleExpression,
            scheduleExpressionTimezone: schedule.ScheduleExpressionTimezone,
            state: schedule.State,
            target: schedule.Target
              ? {
                  arn: schedule.Target.Arn,
                  roleArn: schedule.Target.RoleArn,
                }
              : null,
            creationDate: schedule.CreationDate,
            lastModificationDate: schedule.LastModificationDate,
          };

          // Target input'u parse et ve detaylı bilgileri ekle
          if (schedule.Target?.Input) {
            try {
              const input = JSON.parse(schedule.Target.Input);
              job.messageBody = input;
            } catch (error) {
              // Input parse edilemezse, raw input'u ekle
              job.messageBodyRaw = schedule.Target.Input;
            }
          }

          return job;
        }),
      );

      return jobsWithDetails;
    } catch (error: any) {
      this.logger.error(
        `Cron job'lar listelenirken hata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cron job detaylarını getirir
   * @param scheduleName Schedule adı
   * @param scheduleGroupName Schedule group name (opsiyonel)
   */
  async getCronJobDetails(scheduleName: string, scheduleGroupName?: string) {
    try {
      const schedule = await this.schedulerService.getSchedule(
        scheduleName,
        scheduleGroupName,
      );

      return {
        scheduleName: schedule.Name,
        scheduleGroupName: schedule.GroupName,
        description: schedule.Description,
        scheduleExpression: schedule.ScheduleExpression,
        scheduleExpressionTimezone: schedule.ScheduleExpressionTimezone,
        state: schedule.State,
        target: schedule.Target
          ? {
              arn: schedule.Target.Arn,
              roleArn: schedule.Target.RoleArn,
              sqsParameters: schedule.Target.SqsParameters,
              input: schedule.Target.Input,
            }
          : null,
        flexibleTimeWindow: schedule.FlexibleTimeWindow,
        creationDate: schedule.CreationDate,
        lastModificationDate: schedule.LastModificationDate,
      };
    } catch (error: any) {
      this.logger.error(
        `Cron job detayları alınırken hata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Standart cron formatını AWS EventBridge cron formatına çevirir
   * @param cronExpression Standart cron expression (örn: "0 9 * * 1-5") veya rate formatı (örn: "rate(1 minute)")
   * @returns AWS EventBridge cron formatı (örn: "cron(0 9 * * ? *)") veya rate formatı
   */
  private convertToEventBridgeCron(cronExpression: string): string {
    // Eğer zaten EventBridge formatındaysa (cron(...) veya rate(...) ile başlıyorsa) olduğu gibi döndür
    if (
      cronExpression.startsWith('cron(') ||
      cronExpression.startsWith('rate(')
    ) {
      return cronExpression;
    }

    // Standart cron formatını parse et
    // Format: minute hour day month day-of-week
    const parts = cronExpression.trim().split(/\s+/);

    if (parts.length !== 5) {
      throw new Error(
        `Geçersiz cron expression: ${cronExpression}. Format: "minute hour day month day-of-week" veya "cron(...)" veya "rate(...)"`,
      );
    }

    const [minute, hour, day, month, dayOfWeek] = parts;

    // AWS EventBridge cron formatı: cron(minute hour day-of-month month day-of-week year)
    // year opsiyonel, ? kullanılabilir
    return `cron(${minute} ${hour} ${day} ${month} ${dayOfWeek} ?)`;
  }

  /**
   * Yaygın cron job'lar için hazır yapılandırmalar
   */
  static getCommonCronConfigs(queueUrl: string): CronJobConfig[] {
    return [
      {
        ruleName: 'morning-reminder',
        description: 'Sabah hatırlatması - Her gün 09:00 (Hafta içi)',
        cronExpression: 'cron(0 9 ? * MON-FRI *)',
        queueUrl,
        messageBody: {
          type: 'morning-reminder',
          timestamp: new Date().toISOString(),
        },
        enabled: true,
      },
      {
        ruleName: 'evening-reminder',
        description: 'Akşam hatırlatması - Her gün 17:45 (Hafta içi)',
        cronExpression: 'cron(45 17 ? * MON-FRI *)',
        queueUrl,
        messageBody: {
          type: 'evening-reminder',
          timestamp: new Date().toISOString(),
        },
        enabled: true,
      },
      {
        ruleName: 'daily-reset',
        description: 'Günlük reset - Her gün 00:00',
        cronExpression: 'cron(0 0 * * ? *)',
        queueUrl,
        messageBody: {
          type: 'daily-reset',
          timestamp: new Date().toISOString(),
        },
        enabled: true,
      },
    ];
  }
}

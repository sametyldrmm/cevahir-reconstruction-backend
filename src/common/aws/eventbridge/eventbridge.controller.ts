import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  EventBridgeCronService,
  CronJobConfig,
} from './eventbridge-cron.service';

@ApiTags('EventBridge')
@ApiBearerAuth('JWT-auth')
@Controller('eventbridge')
export class EventBridgeController {
  constructor(
    private readonly eventBridgeCronService: EventBridgeCronService,
  ) {}

  private normalizeTimeZone(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    const timeZone = raw.trim();
    if (!timeZone) return undefined;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
      return timeZone;
    } catch {
      return undefined;
    }
  }

  private getRequestTimeZone(req: Request): string | undefined {
    const headerNames = [
      'x-timezone',
      'cloudfront-viewer-time-zone',
      'cf-timezone',
    ] as const;
    for (const name of headerNames) {
      const header = req.headers[name];
      const raw =
        typeof header === 'string'
          ? header
          : Array.isArray(header)
            ? header[0]
            : undefined;
      const normalized = this.normalizeTimeZone(raw);
      if (normalized) return normalized;
    }
    return undefined;
  }

  /**
   * Yeni bir cron job oluşturur
   */
  @Post('cron-jobs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Yeni bir cron job oluştur',
    description:
      'EventBridge Scheduler API kullanarak yeni bir schedule (cron job) oluşturur ve SQS target ekler. Schedule group desteği mevcuttur.',
  })
  @ApiBody({
    description: 'Cron job yapılandırması',
    schema: {
      type: 'object',
      properties: {
        ruleName: {
          type: 'string',
          description: 'Schedule adı (örn: test2)',
          example: 'test2',
        },
        description: {
          type: 'string',
          description: 'Schedule açıklaması',
          example: "Test2 - Her dakika SQS'ye mesaj gönder",
        },
        cronExpression: {
          type: 'string',
          description:
            'Cron expression veya rate (örn: "rate(1 minute)" veya "cron(0 9 * * ? *)")',
          example: 'rate(1 minute)',
        },
        queueUrl: {
          type: 'string',
          description: 'SQS queue URL',
          example:
            'https://sqs.eu-central-1.amazonaws.com/123456789012/arac-takip.fifo',
        },
        messageBody: {
          type: 'object',
          description: "SQS'ye gönderilecek mesaj body",
          example: {
            type: 'test2',
            message: 'Test mesajı',
          },
        },
        enabled: {
          type: 'boolean',
          description: 'Schedule aktif mi?',
          default: true,
        },
        scheduleGroupName: {
          type: 'string',
          description:
            "Schedule group name (EventBridge Scheduler API - schedule'ları gruplamak için kullanılır)",
          example: 'test',
        },
        scheduleExpressionTimezone: {
          type: 'string',
          description: 'Schedule timezone (IANA, örn: Europe/Istanbul)',
          example: 'Europe/Istanbul',
        },
      },
      required: ['ruleName', 'cronExpression', 'queueUrl'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Cron job başarıyla oluşturuldu',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Cron job oluşturuldu: test2' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Geçersiz parametreler',
  })
  async createCronJob(@Body() config: CronJobConfig, @Req() req: Request) {
    const timeZone = this.getRequestTimeZone(req);
    await this.eventBridgeCronService.createOrUpdateCronJob({
      ...config,
      scheduleExpressionTimezone: config.scheduleExpressionTimezone ?? timeZone,
    });
    return {
      success: true,
      message: `Cron job oluşturuldu: ${config.ruleName}`,
    };
  }

  /**
   * Birden fazla cron job oluşturur
   */
  @Post('cron-jobs/batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Birden fazla cron job oluştur',
    description:
      'EventBridge Scheduler API kullanarak toplu olarak birden fazla cron job oluşturur',
  })
  @ApiBody({
    description: "Cron job yapılandırmaları array'i",
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ruleName: { type: 'string', example: 'test-job-1' },
          description: { type: 'string', example: 'Test job açıklaması' },
          cronExpression: { type: 'string', example: 'rate(1 minute)' },
          queueUrl: {
            type: 'string',
            example:
              'https://sqs.eu-central-1.amazonaws.com/123456789012/arac-takip.fifo',
          },
          messageBody: {
            type: 'object',
            description: "SQS'ye gönderilecek mesaj body",
            example: {
              type: 'test-job',
              message: 'Test mesajı',
            },
          },
          enabled: { type: 'boolean', default: true },
          scheduleGroupName: { type: 'string', example: 'test' },
          scheduleExpressionTimezone: {
            type: 'string',
            description: 'Schedule timezone (IANA, örn: Europe/Istanbul)',
            example: 'Europe/Istanbul',
          },
        },
        required: ['ruleName', 'cronExpression', 'queueUrl'],
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "Cron job'lar oluşturuldu",
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        successCount: { type: 'number', example: 3 },
        failedCount: { type: 'number', example: 0 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Geçersiz parametreler',
  })
  async createMultipleCronJobs(
    @Body() configs: CronJobConfig[],
    @Req() req: Request,
  ) {
    const timeZone = this.getRequestTimeZone(req);
    const normalizedConfigs = configs.map((c) => ({
      ...c,
      scheduleExpressionTimezone: c.scheduleExpressionTimezone ?? timeZone,
    }));
    const result =
      await this.eventBridgeCronService.createMultipleCronJobs(
        normalizedConfigs,
      );
    return {
      success: result.failed === 0,
      successCount: result.success,
      failedCount: result.failed,
    };
  }

  /**
   * Yaygın cron job'ları oluşturur
   */
  @Post('cron-jobs/common')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Yaygın cron job'ları oluştur",
    description:
      "EventBridge Scheduler API kullanarak sabah hatırlatması, akşam hatırlatması ve günlük reset gibi yaygın cron job'ları oluşturur",
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        queueUrl: {
          type: 'string',
          description: 'SQS queue URL',
          example:
            'https://sqs.eu-central-1.amazonaws.com/123456789012/arac-takip.fifo',
        },
      },
      required: ['queueUrl'],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Yaygın cron job'lar oluşturuldu",
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        successCount: { type: 'number', example: 3 },
        failedCount: { type: 'number', example: 0 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Geçersiz parametreler (queueUrl gerekli)',
  })
  async createCommonCronJobs(
    @Body('queueUrl') queueUrl: string,
    @Req() req: Request,
  ) {
    if (!queueUrl) {
      return {
        success: false,
        message: 'queueUrl gerekli',
      };
    }

    const timeZone = this.getRequestTimeZone(req);
    const configs = EventBridgeCronService.getCommonCronConfigs(queueUrl).map(
      (c) => ({
        ...c,
        scheduleExpressionTimezone: c.scheduleExpressionTimezone ?? timeZone,
      }),
    );
    const result =
      await this.eventBridgeCronService.createMultipleCronJobs(configs);
    return {
      success: result.failed === 0,
      successCount: result.success,
      failedCount: result.failed,
    };
  }

  /**
   * Tüm cron job'ları listeler
   */
  @Get('cron-jobs')
  @ApiOperation({
    summary: "Tüm cron job'ları listele",
    description:
      "EventBridge Scheduler'daki tüm schedule'ları listeler. " +
      "Eğer scheduleGroupName belirtilirse, sadece o gruba ait schedule'lar listelenir. " +
      "Belirtilmezse tüm schedule'lar listelenir.",
  })
  @ApiQuery({
    name: 'scheduleGroupName',
    required: false,
    description:
      "Schedule group name ile filtreleme. Belirtilmezse tüm schedule'lar listelenir.",
    example: 'test',
  })
  @ApiResponse({
    status: 200,
    description:
      "Cron job listesi - Auto mail schedule'lar için detaylı bilgiler (mail alıcıları, rapor tipleri vb.) dahil",
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        jobs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              scheduleName: {
                type: 'string',
                example: 'auto-mail-123e4567-e89b-12d3-a456-426614174000',
              },
              scheduleGroupName: { type: 'string', example: 'test' },
              description: {
                type: 'string',
                example:
                  'Auto mail schedule 123e4567-e89b-12d3-a456-426614174000',
              },
              scheduleExpression: { type: 'string', example: 'rate(7 days)' },
              scheduleExpressionTimezone: {
                type: 'string',
                example: 'Europe/Istanbul',
              },
              state: {
                type: 'string',
                enum: ['ENABLED', 'DISABLED'],
                example: 'ENABLED',
              },
              target: {
                type: 'object',
                properties: {
                  arn: { type: 'string' },
                  roleArn: { type: 'string' },
                },
              },
              messageBody: {
                type: 'object',
                description: "SQS'ye gönderilen mesaj body (parse edilmiş)",
                example: {
                  type: 'ANLIK_GPS',
                  timestamp: '2024-01-01T00:00:00.000Z',
                  source: 'eventbridge-scheduler',
                },
              },
              creationDate: { type: 'string', format: 'date-time' },
              lastModificationDate: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  async listCronJobs(@Query('scheduleGroupName') scheduleGroupName?: string) {
    const jobs =
      await this.eventBridgeCronService.listCronJobs(scheduleGroupName);
    return {
      success: true,
      jobs,
    };
  }

  /**
   * Belirli bir cron job'ın detaylarını getirir
   */
  @Get('cron-jobs/:scheduleName')
  @ApiOperation({
    summary: 'Cron job detaylarını getir',
    description: "Belirli bir schedule'ın detaylarını getirir",
  })
  @ApiParam({
    name: 'scheduleName',
    description: 'Schedule adı',
    example: 'test2',
  })
  @ApiQuery({
    name: 'scheduleGroupName',
    required: false,
    description: 'Schedule group name (opsiyonel)',
    example: 'test',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron job detayları',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        job: {
          type: 'object',
          properties: {
            scheduleName: { type: 'string', example: 'test2' },
            scheduleGroupName: { type: 'string', example: 'test' },
            description: { type: 'string' },
            scheduleExpression: { type: 'string', example: 'rate(1 minute)' },
            scheduleExpressionTimezone: {
              type: 'string',
              example: 'Europe/Istanbul',
            },
            state: {
              type: 'string',
              enum: ['ENABLED', 'DISABLED'],
              example: 'ENABLED',
            },
            target: {
              type: 'object',
              properties: {
                arn: { type: 'string' },
                roleArn: { type: 'string' },
                sqsParameters: {
                  type: 'object',
                  properties: {
                    MessageGroupId: { type: 'string' },
                  },
                },
                input: { type: 'string' },
              },
            },
            flexibleTimeWindow: {
              type: 'object',
              properties: {
                mode: { type: 'string', enum: ['OFF', 'FLEXIBLE'] },
                maximumWindowInMinutes: { type: 'number' },
              },
            },
            creationDate: { type: 'string', format: 'date-time' },
            lastModificationDate: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Cron job bulunamadı',
  })
  async getCronJobDetails(
    @Param('scheduleName') scheduleName: string,
    @Query('scheduleGroupName') scheduleGroupName?: string,
  ) {
    const details = await this.eventBridgeCronService.getCronJobDetails(
      scheduleName,
      scheduleGroupName,
    );
    return {
      success: true,
      job: details,
    };
  }

  /**
   * Cron job'ı günceller
   */
  @Put('cron-jobs/:scheduleName')
  @ApiOperation({
    summary: 'Cron job güncelle',
    description:
      "EventBridge Scheduler API kullanarak mevcut bir schedule'ı günceller",
  })
  @ApiParam({
    name: 'scheduleName',
    description: 'Schedule adı',
    example: 'test2',
  })
  @ApiBody({
    description: 'Güncellenecek cron job yapılandırması (scheduleName hariç)',
    schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Schedule açıklaması',
          example: 'Güncellenmiş açıklama',
        },
        cronExpression: {
          type: 'string',
          description:
            'Cron expression veya rate (örn: "rate(5 minutes)" veya "cron(0 10 * * ? *)")',
          example: 'rate(5 minutes)',
        },
        queueUrl: {
          type: 'string',
          description: 'SQS queue URL',
          example:
            'https://sqs.eu-central-1.amazonaws.com/123456789012/arac-takip.fifo',
        },
        messageBody: {
          type: 'object',
          description: "SQS'ye gönderilecek mesaj body",
          example: {
            type: 'updated',
            message: 'Güncellenmiş mesaj',
          },
        },
        enabled: {
          type: 'boolean',
          description: 'Schedule aktif mi?',
          default: true,
          example: true,
        },
        scheduleGroupName: {
          type: 'string',
          description: 'Schedule group name (EventBridge Scheduler API)',
          example: 'test',
        },
        scheduleExpressionTimezone: {
          type: 'string',
          description: 'Schedule timezone (IANA, örn: Europe/Istanbul)',
          example: 'Europe/Istanbul',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Cron job güncellendi',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Cron job güncellendi: test2' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Cron job bulunamadı',
  })
  @ApiResponse({
    status: 400,
    description: 'Geçersiz parametreler',
  })
  async updateCronJob(
    @Param('scheduleName') scheduleName: string,
    @Body() config: Omit<CronJobConfig, 'ruleName'>,
    @Req() req: Request,
  ) {
    const timeZone = this.getRequestTimeZone(req);
    await this.eventBridgeCronService.createOrUpdateCronJob({
      ...config,
      ruleName: scheduleName,
      scheduleExpressionTimezone: config.scheduleExpressionTimezone ?? timeZone,
    });
    return {
      success: true,
      message: `Cron job güncellendi: ${scheduleName}`,
    };
  }

  /**
   * Cron job'ı siler
   */
  @Delete('cron-jobs/:scheduleName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cron job sil',
    description: "EventBridge Scheduler API kullanarak bir schedule'ı siler",
  })
  @ApiParam({
    name: 'scheduleName',
    description: 'Schedule adı',
    example: 'test2',
  })
  @ApiQuery({
    name: 'scheduleGroupName',
    required: false,
    description: 'Schedule group name (opsiyonel)',
    example: 'test',
  })
  @ApiResponse({
    status: 204,
    description: 'Cron job silindi',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Cron job silindi: test2' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Cron job bulunamadı',
  })
  async deleteCronJob(
    @Param('scheduleName') scheduleName: string,
    @Query('scheduleGroupName') scheduleGroupName?: string,
  ) {
    await this.eventBridgeCronService.deleteCronJob(
      scheduleName,
      scheduleGroupName,
    );
    return {
      success: true,
      message: `Cron job silindi: ${scheduleName}`,
    };
  }

  /**
   * Cron job'ı devre dışı bırakır
   */
  @Put('cron-jobs/:scheduleName/disable')
  @ApiOperation({
    summary: 'Cron job devre dışı bırak',
    description:
      "EventBridge Scheduler API kullanarak bir schedule'ı geçici olarak devre dışı bırakır (silmeden)",
  })
  @ApiParam({
    name: 'scheduleName',
    description: 'Schedule adı',
    example: 'test2',
  })
  @ApiQuery({
    name: 'scheduleGroupName',
    required: false,
    description: 'Schedule group name (opsiyonel)',
    example: 'test',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron job devre dışı bırakıldı',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Cron job devre dışı bırakıldı: test2',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Cron job bulunamadı',
  })
  async disableCronJob(
    @Param('scheduleName') scheduleName: string,
    @Query('scheduleGroupName') scheduleGroupName?: string,
  ) {
    await this.eventBridgeCronService.disableCronJob(
      scheduleName,
      scheduleGroupName,
    );
    return {
      success: true,
      message: `Cron job devre dışı bırakıldı: ${scheduleName}`,
    };
  }

  /**
   * Cron job'ı etkinleştirir
   */
  @Put('cron-jobs/:scheduleName/enable')
  @ApiOperation({
    summary: 'Cron job etkinleştir',
    description:
      "EventBridge Scheduler API kullanarak devre dışı bırakılmış bir schedule'ı tekrar etkinleştirir",
  })
  @ApiParam({
    name: 'scheduleName',
    description: 'Schedule adı',
    example: 'test2',
  })
  @ApiQuery({
    name: 'scheduleGroupName',
    required: false,
    description: 'Schedule group name (opsiyonel)',
    example: 'test',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron job etkinleştirildi',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Cron job etkinleştirildi: test2' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Cron job bulunamadı',
  })
  async enableCronJob(
    @Param('scheduleName') scheduleName: string,
    @Query('scheduleGroupName') scheduleGroupName?: string,
  ) {
    await this.eventBridgeCronService.enableCronJob(
      scheduleName,
      scheduleGroupName,
    );
    return {
      success: true,
      message: `Cron job etkinleştirildi: ${scheduleName}`,
    };
  }
}

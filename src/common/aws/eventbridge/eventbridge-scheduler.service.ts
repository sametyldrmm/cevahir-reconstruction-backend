import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SchedulerClient,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  DeleteScheduleCommand,
  GetScheduleCommand,
  ListSchedulesCommand,
} from '@aws-sdk/client-scheduler';
import { AwsClientFactory } from '../common/aws-client.factory';

export interface CreateScheduleParams {
  scheduleName: string;
  description?: string;
  scheduleExpression: string; // Cron veya rate expression (örn: "rate(1 minute)" veya "cron(0 9 * * ? *)")
  scheduleExpressionTimezone?: string; // Timezone (örn: "Europe/Istanbul")
  state?: 'ENABLED' | 'DISABLED';
  scheduleGroupName?: string; // Schedule group name (örn: "test")
  flexibleTimeWindow?: {
    mode: 'OFF' | 'FLEXIBLE';
    maximumWindowInMinutes?: number;
  };
  target: {
    arn: string; // SQS queue ARN
    roleArn?: string; // IAM role ARN (EventBridge'in SQS'ye yazabilmesi için)
    sqsParameters?: {
      MessageGroupId?: string; // FIFO queue için (büyük harf ile başlamalı)
    };
    input?: string; // Mesaj body (JSON string)
    inputTransformer?: {
      inputPathsMap?: Record<string, string>;
      inputTemplate: string;
    };
  };
}

export interface UpdateScheduleParams extends CreateScheduleParams {}

@Injectable()
export class EventBridgeSchedulerService {
  private readonly logger = new Logger(EventBridgeSchedulerService.name);
  private readonly schedulerClient: SchedulerClient;
  private readonly region: string;

  constructor(
    private readonly awsClientFactory: AwsClientFactory,
    private readonly configService: ConfigService,
  ) {
    this.region =
      this.configService.get<string>('AWS_REGION') || 'eu-central-1';

    // AWS SDK v3 EventBridge Scheduler Client
    this.schedulerClient = new SchedulerClient({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  /**
   * EventBridge Scheduler API'sini kullanarak schedule oluşturur
   * AWS SDK v3 SchedulerClient kullanıyor
   * Not: Schedule group'lar otomatik oluşturulur, manuel oluşturma gerekmez
   */
  async createSchedule(params: CreateScheduleParams): Promise<any> {
    this.logger.log('='.repeat(80));
    this.logger.log('📋 createSchedule() fonksiyonu başlatıldı');
    this.logger.log('='.repeat(80));
    this.logger.log(`   📝 Gelen Parametreler:`);
    this.logger.log(`      Schedule Name: ${params.scheduleName}`);
    this.logger.log(
      `      Schedule Group: ${params.scheduleGroupName || 'default'}`,
    );
    this.logger.log(`      Schedule Expression: ${params.scheduleExpression}`);
    this.logger.log(`      Schedule Timezone: ${params.scheduleExpressionTimezone || 'UTC (default)'}`);
    this.logger.log(`      State: ${params.state || 'ENABLED'}`);
    this.logger.log(`      Description: ${params.description || 'N/A'}`);
    this.logger.log(`      Target ARN: ${params.target.arn}`);
    this.logger.log(
      `      Target Role ARN: ${params.target.roleArn || 'N/A (will use default)'}`,
    );
    this.logger.log(
      `      SQS Parameters: ${params.target.sqsParameters ? JSON.stringify(params.target.sqsParameters) : 'N/A'}`,
    );
    this.logger.log(`      Input: ${params.target.input || 'N/A'}`);
    this.logger.log('='.repeat(80));

    try {
      // RoleArn zorunlu, eğer yoksa default değeri kullan
      const roleArn =
        params.target.roleArn ||
        this.configService.get<string>('AWS_EVENTBRIDGE_ROLE_ARN') ||
        'arn:aws:iam::097352008757:role/service-role/Amazon_EventBridge_Scheduler_SQS_6d235f6626';

      this.logger.log(`   🔧 Role ARN belirlendi: ${roleArn}`);
      this.logger.log(`   🌍 Region: ${this.region}`);

      const targetConfig: any = {
        Arn: params.target.arn,
        RoleArn: roleArn,
      };

      if (params.target.sqsParameters) {
        targetConfig.SqsParameters = {
          MessageGroupId: params.target.sqsParameters.MessageGroupId,
        };
        this.logger.log(
          `   📦 SQS Parameters eklendi:`,
          JSON.stringify(targetConfig.SqsParameters),
        );
      }

      if (params.target.input) {
        targetConfig.Input = params.target.input;
        this.logger.log(
          `   📝 Input eklendi: ${targetConfig.Input.substring(0, 100)}...`,
        );
      }

      if (params.target.inputTransformer) {
        targetConfig.InputTransformer = params.target.inputTransformer;
        this.logger.log(`   🔄 Input Transformer eklendi`);
      }

      const commandConfig: any = {
        Name: params.scheduleName,
        ScheduleExpression: params.scheduleExpression,
        State: params.state || 'ENABLED',
        Target: targetConfig,
        FlexibleTimeWindow: params.flexibleTimeWindow
          ? {
              Mode: params.flexibleTimeWindow.mode,
              ...(params.flexibleTimeWindow.maximumWindowInMinutes && {
                MaximumWindowInMinutes:
                  params.flexibleTimeWindow.maximumWindowInMinutes,
              }),
            }
          : { Mode: 'OFF' },
      };

      if (params.description) {
        commandConfig.Description = params.description;
      }

      if (params.scheduleExpressionTimezone) {
        commandConfig.ScheduleExpressionTimezone =
          params.scheduleExpressionTimezone;
      }

      if (params.scheduleGroupName) {
        commandConfig.GroupName = params.scheduleGroupName;
      }

      this.logger.log(
        `   📋 CreateScheduleCommand yapılandırması:`,
        JSON.stringify(
          {
            Name: commandConfig.Name,
            ScheduleExpression: commandConfig.ScheduleExpression,
            State: commandConfig.State,
            GroupName: commandConfig.GroupName,
            TargetArn: commandConfig.Target.Arn,
            TargetRoleArn: commandConfig.Target.RoleArn,
            TargetSqsParameters: commandConfig.Target.SqsParameters,
            FlexibleTimeWindow: commandConfig.FlexibleTimeWindow,
          },
          null,
          2,
        ),
      );

      this.logger.log(`   🚀 CreateScheduleCommand oluşturuluyor...`);
      const command = new CreateScheduleCommand(commandConfig);

      this.logger.log(`   📡 AWS SDK send() çağrılıyor...`);
      const result = await this.schedulerClient.send(command);

      this.logger.log('='.repeat(80));
      this.logger.log(
        `   ✅ EventBridge Scheduler schedule başarıyla oluşturuldu!`,
      );
      this.logger.log(
        `   📊 Result:`,
        JSON.stringify(
          {
            ScheduleArn: result.ScheduleArn,
          },
          null,
          2,
        ),
      );
      this.logger.log('='.repeat(80));

      return result;
    } catch (error: any) {
      // Detaylı hata loglama
      this.logger.error('='.repeat(80));
      this.logger.error(
        `   ❌ EventBridge Scheduler schedule oluşturulurken hata:`,
      );
      this.logger.error(
        `      Error Name: ${error.name || error.Code || error.code || 'Unknown'}`,
      );
      this.logger.error(`      Error Message: ${error.message}`);
      this.logger.error(`      Schedule Name: ${params.scheduleName}`);
      this.logger.error(
        `      Schedule Group: ${params.scheduleGroupName || 'default'}`,
      );
      this.logger.error(
        `      Schedule Expression: ${params.scheduleExpression}`,
      );
      this.logger.error(`      Target ARN: ${params.target.arn}`);
      this.logger.error(`      Region: ${this.region}`);

      if (error.$metadata) {
        this.logger.error(`      Request ID: ${error.$metadata.requestId}`);
        this.logger.error(
          `      HTTP Status: ${error.$metadata.httpStatusCode}`,
        );
      }

      this.logger.error(`      Stack Trace:`, error.stack);
      this.logger.error('='.repeat(80));
      throw error;
    }
  }

  /**
   * Schedule'ı günceller
   */
  async updateSchedule(params: UpdateScheduleParams): Promise<any> {
    try {
      // RoleArn zorunlu, eğer yoksa default değeri kullan
      const roleArn =
        params.target.roleArn ||
        this.configService.get<string>('AWS_EVENTBRIDGE_ROLE_ARN') ||
        'arn:aws:iam::097352008757:role/service-role/Amazon_EventBridge_Scheduler_SQS_6d235f6626';

      const command = new UpdateScheduleCommand({
        Name: params.scheduleName,
        ScheduleExpression: params.scheduleExpression,
        State: params.state || 'ENABLED',
        Target: {
          Arn: params.target.arn,
          RoleArn: roleArn,
          ...(params.target.sqsParameters && {
            SqsParameters: {
              MessageGroupId: params.target.sqsParameters.MessageGroupId,
            },
          }),
          ...(params.target.input && { Input: params.target.input }),
          ...(params.target.inputTransformer && {
            InputTransformer: params.target.inputTransformer,
          }),
        },
        ...(params.description && { Description: params.description }),
        ...(params.scheduleExpressionTimezone && {
          ScheduleExpressionTimezone: params.scheduleExpressionTimezone,
        }),
        ...(params.scheduleGroupName && {
          GroupName: params.scheduleGroupName,
        }),
        FlexibleTimeWindow: params.flexibleTimeWindow
          ? {
              Mode: params.flexibleTimeWindow.mode,
              ...(params.flexibleTimeWindow.maximumWindowInMinutes && {
                MaximumWindowInMinutes:
                  params.flexibleTimeWindow.maximumWindowInMinutes,
              }),
            }
          : { Mode: 'OFF' },
      });

      const result = await this.schedulerClient.send(command);

      this.logger.log(
        `EventBridge Scheduler schedule güncellendi: ${params.scheduleName}`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(
        `EventBridge Scheduler schedule güncellenirken hata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Schedule'ı siler
   */
  async deleteSchedule(
    scheduleName: string,
    scheduleGroupName?: string,
  ): Promise<void> {
    try {
      const command = new DeleteScheduleCommand({
        Name: scheduleName,
        ...(scheduleGroupName && { GroupName: scheduleGroupName }),
      });

      await this.schedulerClient.send(command);
      this.logger.log(
        `EventBridge Scheduler schedule silindi: ${scheduleName}`,
      );
    } catch (error: any) {
      this.logger.error(
        `EventBridge Scheduler schedule silinirken hata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Schedule'ları listeler
   */
  async listSchedules(
    scheduleGroupName?: string,
    namePrefix?: string,
  ): Promise<any[]> {
    try {
      const command = new ListSchedulesCommand({
        ...(scheduleGroupName && { GroupName: scheduleGroupName }),
        ...(namePrefix && { NamePrefix: namePrefix }),
        MaxResults: 100,
      });

      const result = await this.schedulerClient.send(command);
      return result.Schedules || [];
    } catch (error: any) {
      this.logger.error(
        `EventBridge Scheduler schedule'ları listelenirken hata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Schedule detaylarını getirir
   */
  async getSchedule(
    scheduleName: string,
    scheduleGroupName?: string,
  ): Promise<any> {
    this.logger.log('='.repeat(80));
    this.logger.log('📋 getSchedule() fonksiyonu başlatıldı');
    this.logger.log('='.repeat(80));
    this.logger.log(`   📝 Parametreler:`);
    this.logger.log(`      Schedule Name: ${scheduleName}`);
    this.logger.log(`      Schedule Group: ${scheduleGroupName || 'default'}`);
    this.logger.log(`      Region: ${this.region}`);
    this.logger.log('='.repeat(80));

    try {
      const commandConfig: any = {
        Name: scheduleName,
      };

      if (scheduleGroupName) {
        commandConfig.GroupName = scheduleGroupName;
      }

      this.logger.log(
        `   📋 GetScheduleCommand yapılandırması:`,
        JSON.stringify(commandConfig, null, 2),
      );
      this.logger.log(`   🚀 GetScheduleCommand oluşturuluyor...`);
      const command = new GetScheduleCommand(commandConfig);

      this.logger.log(`   📡 AWS SDK send() çağrılıyor...`);
      const result = await this.schedulerClient.send(command);

      this.logger.log('='.repeat(80));
      this.logger.log(`   ✅ Schedule başarıyla bulundu!`);
      this.logger.log(
        `   📊 Schedule Detayları:`,
        JSON.stringify(
          {
            Name: result.Name,
            ScheduleArn: result.Arn,
            State: result.State,
            ScheduleExpression: result.ScheduleExpression,
            GroupName: result.GroupName,
            TargetArn: result.Target?.Arn,
            TargetRoleArn: result.Target?.RoleArn,
            TargetSqsParameters: result.Target?.SqsParameters,
          },
          null,
          2,
        ),
      );
      this.logger.log('='.repeat(80));

      return result;
    } catch (error: any) {
      this.logger.error('='.repeat(80));
      this.logger.error(`   ❌ getSchedule() hatası:`);
      this.logger.error(
        `      Error Name: ${error.name || error.Code || error.code || 'Unknown'}`,
      );
      this.logger.error(`      Error Message: ${error.message}`);
      this.logger.error(`      Schedule Name: ${scheduleName}`);
      this.logger.error(
        `      Schedule Group: ${scheduleGroupName || 'default'}`,
      );
      this.logger.error(`      Region: ${this.region}`);

      if (error.$metadata) {
        this.logger.error(`      Request ID: ${error.$metadata.requestId}`);
        this.logger.error(
          `      HTTP Status: ${error.$metadata.httpStatusCode}`,
        );
      }

      this.logger.error(`      Stack Trace:`, error.stack);
      this.logger.error('='.repeat(80));
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

    return `arn:aws:sqs:${this.region}:${accountId}:${queueName}`;
  }

  /**
   * Schedule oluşturur ve SQS target ekler (kolay kullanım için)
   */
  async createScheduleWithSqsTarget(
    scheduleName: string,
    scheduleExpression: string,
    queueUrl: string,
    messageBody?: any,
    description?: string,
    scheduleGroupName?: string,
    messageGroupId?: string,
    scheduleExpressionTimezone?: string,
  ): Promise<any> {
    this.logger.log('='.repeat(80));
    this.logger.log('📋 createScheduleWithSqsTarget() fonksiyonu başlatıldı');
    this.logger.log('='.repeat(80));
    this.logger.log(`   📝 Parametreler:`);
    this.logger.log(`      Schedule Name: ${scheduleName}`);
    this.logger.log(`      Schedule Expression: ${scheduleExpression}`);
    this.logger.log(`      Schedule Timezone: ${scheduleExpressionTimezone || 'UTC (default)'}`);
    this.logger.log(`      Queue URL: ${queueUrl}`);
    this.logger.log(
      `      Schedule Group Name: ${scheduleGroupName || 'default'}`,
    );
    this.logger.log(`      Message Group ID: ${messageGroupId || 'N/A'}`);
    this.logger.log(`      Description: ${description || 'N/A'}`);
    this.logger.log(
      `      Message Body:`,
      JSON.stringify(messageBody || {}, null, 2),
    );
    this.logger.log('='.repeat(80));

    try {
      this.logger.log(`   🔧 Queue ARN oluşturuluyor...`);
      const queueArn = this.getQueueArn(queueUrl);
      this.logger.log(`      ✅ Queue ARN: ${queueArn}`);

      const roleArn =
        this.configService.get<string>('AWS_EVENTBRIDGE_ROLE_ARN') ||
        'arn:aws:iam::097352008757:role/service-role/Amazon_EventBridge_Scheduler_SQS_6d235f6626';
      this.logger.log(`      Role ARN: ${roleArn}`);

      if (!roleArn) {
        this.logger.warn(
          '      ⚠️  AWS_EVENTBRIDGE_ROLE_ARN tanımlı değil. IAM role gerekli olabilir.',
        );
      }

      const isFifoQueue = queueUrl.endsWith('.fifo');
      this.logger.log(`      Is FIFO Queue: ${isFifoQueue}`);

      // FIFO queue için MessageGroupId - büyük harfle başlamalı
      let finalMessageGroupId = messageGroupId || `${scheduleName}-group`;
      if (isFifoQueue && finalMessageGroupId) {
        finalMessageGroupId = this.capitalizeFirst(finalMessageGroupId);
      }
      this.logger.log(
        `      Final Message Group ID: ${finalMessageGroupId || 'N/A'}`,
      );

      const target: any = {
        arn: queueArn,
        ...(roleArn && { roleArn }),
        ...(isFifoQueue && {
          sqsParameters: {
            MessageGroupId: finalMessageGroupId,
          },
        }),
      };

      // Mesaj body varsa input olarak ekle
      if (messageBody) {
        target.input = JSON.stringify(messageBody);
        this.logger.log(`      Target Input: ${target.input}`);
      }

      this.logger.log(
        `   📦 Target yapılandırması:`,
        JSON.stringify(
          {
            Arn: target.arn,
            RoleArn: target.roleArn,
            SqsParameters: target.sqsParameters,
            Input: target.input ? 'set' : 'not set',
          },
          null,
          2,
        ),
      );

      const scheduleParams: CreateScheduleParams = {
        scheduleName,
        description,
        scheduleExpression,
        scheduleGroupName,
        state: 'ENABLED',
        scheduleExpressionTimezone,
        target,
      };

      this.logger.log(`   📋 Schedule Params:`, JSON.stringify({
        scheduleName: scheduleParams.scheduleName,
        description: scheduleParams.description,
        scheduleExpression: scheduleParams.scheduleExpression,
        scheduleExpressionTimezone: scheduleParams.scheduleExpressionTimezone || 'UTC (default)',
        scheduleGroupName: scheduleParams.scheduleGroupName,
        state: scheduleParams.state,
        targetArn: scheduleParams.target.arn,
        targetRoleArn: scheduleParams.target.roleArn,
        targetSqsParameters: scheduleParams.target.sqsParameters,
      }, null, 2));

      this.logger.log(`   🚀 createSchedule() çağrılıyor...`);
      const result = await this.createSchedule(scheduleParams);

      this.logger.log('='.repeat(80));
      this.logger.log(`   ✅ createScheduleWithSqsTarget() başarılı`);
      this.logger.log(
        `   📊 Result:`,
        JSON.stringify(
          {
            ScheduleArn: result.ScheduleArn,
          },
          null,
          2,
        ),
      );
      this.logger.log('='.repeat(80));

      return result;
    } catch (error: any) {
      this.logger.error('='.repeat(80));
      this.logger.error(`   ❌ createScheduleWithSqsTarget() hatası:`);
      this.logger.error(`      Error Name: ${error.name || error.Code || error.code || 'Unknown'}`);
      this.logger.error(`      Error Message: ${error.message}`);
      this.logger.error(`      Error Stack: ${error.stack}`);
      if (error.$metadata) {
        this.logger.error(`      Request ID: ${error.$metadata.requestId}`);
        this.logger.error(`      HTTP Status: ${error.$metadata.httpStatusCode}`);
      }
      this.logger.error('='.repeat(80));
      throw error;
    }
  }

  /**
   * Schedule oluşturur ve Lambda (sqs-target) hedefi ekler.
   * Akış: Scheduler → Lambda → SQS
   * Lambda event: { queueUrl: string, body: any }
   */
  async createScheduleWithLambdaTarget(
    scheduleName: string,
    scheduleExpression: string,
    lambdaArn: string,
    input: { queueUrl: string; body: any },
    description?: string,
    scheduleGroupName?: string,
    scheduleExpressionTimezone?: string,
  ): Promise<any> {
    this.logger.log('='.repeat(80));
    this.logger.log('📋 createScheduleWithLambdaTarget() fonksiyonu başlatıldı');
    this.logger.log('='.repeat(80));
    this.logger.log(`   📝 Parametreler:`);
    this.logger.log(`      Schedule Name: ${scheduleName}`);
    this.logger.log(`      Schedule Expression: ${scheduleExpression}`);
    this.logger.log(`      Schedule Timezone: ${scheduleExpressionTimezone || 'UTC (default)'}`);
    this.logger.log(`      Lambda ARN: ${lambdaArn}`);
    this.logger.log(`      Schedule Group Name: ${scheduleGroupName || 'default'}`);
    this.logger.log(`      Description: ${description || 'N/A'}`);
    this.logger.log(`      Input (queueUrl, body):`, JSON.stringify({ queueUrl: input?.queueUrl, body: input?.body }, null, 2));
    this.logger.log('='.repeat(80));

    try {
      const roleArn =
        this.configService.get<string>('AWS_EVENTBRIDGE_LAMBDA_TARGET_ROLE_ARN') ||
        this.configService.get<string>('AWS_EVENTBRIDGE_ROLE_ARN');
      this.logger.log(`      Role ARN: ${roleArn || 'not set'}`);

      if (!roleArn) {
        this.logger.warn(
          '      ⚠️  AWS_EVENTBRIDGE_LAMBDA_TARGET_ROLE_ARN veya AWS_EVENTBRIDGE_ROLE_ARN tanımlı değil. EventBridge Scheduler için Lambda invoke yetkisi gerekli.',
        );
      }

      // EventBridge Scheduler: Lambda'ya giden payload "Target.Input" ile verilir (Console'da Target → Input, Custom JSON).
      // "Payload" alanı Scheduler'da kullanılmaz; boş kalırsa Lambda varsayılan Scheduled Event alır (detail: {}).
      const target: any = {
        arn: lambdaArn,
        ...(roleArn && { roleArn }),
        input: JSON.stringify(input),
      };

      this.logger.log(`   📦 Target yapılandırması:`, JSON.stringify({
        Arn: target.arn,
        RoleArn: target.roleArn,
        Input: target.input ? 'set' : 'not set',
      }, null, 2));

      const scheduleParams: CreateScheduleParams = {
        scheduleName,
        description,
        scheduleExpression,
        scheduleGroupName,
        state: 'ENABLED',
        scheduleExpressionTimezone,
        target,
      };

      this.logger.log(`   🚀 createSchedule() çağrılıyor...`);
      const result = await this.createSchedule(scheduleParams);

      this.logger.log('='.repeat(80));
      this.logger.log(`   ✅ createScheduleWithLambdaTarget() başarılı`);
      this.logger.log(`   📊 Result:`, JSON.stringify({ ScheduleArn: result.ScheduleArn }, null, 2));
      this.logger.log('='.repeat(80));

      return result;
    } catch (error: any) {
      this.logger.error('='.repeat(80));
      this.logger.error(`   ❌ createScheduleWithLambdaTarget() hatası:`);
      this.logger.error(`      Error Name: ${error.name || error.Code || error.code || 'Unknown'}`);
      this.logger.error(`      Error Message: ${error.message}`);
      this.logger.error(`      Error Stack: ${error.stack}`);
      if (error.$metadata) {
        this.logger.error(`      Request ID: ${error.$metadata.requestId}`);
        this.logger.error(`      HTTP Status: ${error.$metadata.httpStatusCode}`);
      }
      this.logger.error('='.repeat(80));
      throw error;
    }
  }

  /**
   * String'in ilk harfini büyük yapar (FIFO queue MessageGroupId için gerekli)
   */
  private capitalizeFirst(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RedisConnectionService } from './redis-connection.service';
import { QueueNames } from './queue.types';

@ApiTags('queue-health')
@Controller('queue-health')
export class QueueHealthController {
  constructor(
    private readonly redisConnectionService: RedisConnectionService,
  ) {}

  @Get('redis-connection')
  @ApiOperation({
    summary: 'Redis Bağlantı Durumu',
    description:
      'Redis bağlantısının durumunu ve yapılandırmasını kontrol eder',
  })
  @ApiResponse({
    status: 200,
    description: 'Redis bağlantı bilgileri',
  })
  async checkRedisConnection() {
    const connection = await this.redisConnectionService.testConnection();
    const info = await this.redisConnectionService.getRedisInfo();

    return {
      connection,
      redisInfo: info,
      message: connection.connected
        ? '✅ Redis bağlantısı aktif ve çalışıyor'
        : '❌ Redis bağlantısı başarısız',
    };
  }

  @Get('queue/:queueName')
  @ApiOperation({
    summary: 'Queue Redis Kontrolü',
    description:
      "Belirtilen queue'nun Redis'te oluşturulduğunu ve çalıştığını doğrular",
  })
  @ApiParam({
    name: 'queueName',
    description: 'Queue adı',
    example: 'test1-queue',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue Redis durumu',
  })
  async checkQueue(@Param('queueName') queueName: string) {
    const queueKeys =
      await this.redisConnectionService.checkQueueKeys(queueName);
    const connection = await this.redisConnectionService.testConnection();

    return {
      queueName,
      redisConnected: connection.connected,
      queueExists: queueKeys.exists,
      redisKeys: queueKeys.keys,
      jobCounts: queueKeys.jobCounts,
      message: queueKeys.exists
        ? `✅ Queue "${queueName}" Redis'te mevcut ve çalışıyor`
        : `⚠️ Queue "${queueName}" Redis'te bulunamadı (henüz job eklenmemiş olabilir)`,
    };
  }

  @Get('queues')
  @ApiOperation({
    summary: "Tüm Queue'ları Listele",
    description: "Redis'teki tüm queue'ları listeler",
  })
  @ApiResponse({
    status: 200,
    description: 'Queue listesi',
  })
  async listAllQueues() {
    const queues = await this.redisConnectionService.listAllQueues();
    const connection = await this.redisConnectionService.testConnection();

    return {
      redisConnected: connection.connected,
      queues,
      totalQueues: queues.length,
      registeredQueues: Object.values(QueueNames),
      message: `Redis'te ${queues.length} queue bulundu`,
    };
  }

  @Get('verify-scale')
  @ApiOperation({
    summary: 'Scale Edilebilirlik Doğrulama',
    description:
      "Queue'ların Redis üzerinden scale edilebilir olduğunu doğrular",
  })
  @ApiResponse({
    status: 200,
    description: 'Scale edilebilirlik bilgileri',
  })
  async verifyScalability() {
    const connection = await this.redisConnectionService.testConnection();
    const redisInfo = await this.redisConnectionService.getRedisInfo();
    const allQueues = await this.redisConnectionService.listAllQueues();

    // Test queue'larını kontrol et
    const test1Queue = await this.redisConnectionService.checkQueueKeys(
      QueueNames.TEST1_QUEUE,
    );
    const test2Queue = await this.redisConnectionService.checkQueueKeys(
      QueueNames.TEST2_QUEUE,
    );

    return {
      redisConnection: {
        connected: connection.connected,
        host: connection.host,
        port: connection.port,
        db: connection.db,
      },
      redisInfo,
      scalability: {
        canScale: connection.connected,
        reason: connection.connected
          ? "✅ Redis bağlantısı aktif - Birden fazla worker instance aynı Redis'i kullanabilir"
          : '❌ Redis bağlantısı yok - Scale edilemez',
        queuesInRedis: allQueues.length,
        testQueues: {
          test1: {
            exists: test1Queue.exists,
            keys: test1Queue.keys.length,
          },
          test2: {
            exists: test2Queue.exists,
            keys: test2Queue.keys.length,
          },
        },
      },
      instructions: {
        scaling: connection.connected
          ? [
              "1. Aynı Redis instance'ını kullanan birden fazla worker başlatabilirsiniz",
              "2. Her worker aynı queue'yu dinleyecek ve job'ları paylaşacak",
              "3. Job'lar Redis üzerinden dağıtılacak ve load balancing otomatik olacak",
              "4. Kubernetes'te worker deployment'ını scale edebilirsiniz",
            ]
          : ['Redis bağlantısı olmadan scale edilemez'],
      },
    };
  }
}

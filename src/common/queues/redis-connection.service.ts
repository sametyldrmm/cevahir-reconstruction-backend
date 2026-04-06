import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueConfig } from './queue.types';
import Redis from 'ioredis';

/**
 * Redis Connection Service
 * Redis bağlantısını test eder ve queue'ların Redis üzerinden çalıştığını doğrular
 */
@Injectable()
export class RedisConnectionService implements OnModuleInit {
  private readonly logger = new Logger(RedisConnectionService.name);
  private redisClient: Redis | null = null;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private lastErrorTime = 0;
  private errorThrottleMs = 10000; // 10 saniyede bir error log'la

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Redis bağlantısını async olarak başlat, hata olsa bile uygulama çalışsın
    this.initializeRedisClient().catch((error) => {
      this.logger.warn(
        'Redis bağlantısı başlatılamadı, uygulama devam ediyor:',
        error.message,
      );
    });
  }

  /**
   * Redis client'ı başlat ve bağlantıyı test et
   */
  private async initializeRedisClient() {
    try {
      // Public URL varsa ve local development'ta ise onu kullan
      const publicUrl = this.configService.get<string>('REDIS_PUBLIC_URL');
      let host =
        this.configService.get<string>('REDIS_HOST') ||
        QueueConfig.connection.host;
      let port =
        this.configService.get<number>('REDIS_PORT') ||
        QueueConfig.connection.port;
      const password =
        this.configService.get<string>('REDIS_PASSWORD') ||
        QueueConfig.connection.password;
      const db =
        this.configService.get<number>('REDIS_DB') || QueueConfig.connection.db;

      // Eğer public URL varsa ve host internal ise (local development), public URL'i parse et
      if (publicUrl && host.includes('railway.internal')) {
        try {
          const url = new URL(publicUrl);
          host = url.hostname;
          port = parseInt(url.port, 10);
          this.logger.log(
            `🌐 Local development için Public Redis URL kullanılıyor: ${host}:${port}`,
          );
        } catch (e) {
          this.logger.warn(
            'Public URL parse edilemedi, default host kullanılıyor',
          );
        }
      }

      this.logger.log(
        `🔌 Redis bağlantısı deneniyor: ${host}:${port} (DB: ${db})`,
      );

      this.redisClient = new Redis({
        host,
        port,
        password: password || undefined,
        db,
        retryStrategy: (times) => {
          // Maksimum 3 deneme yap, sonra durdur
          if (times > this.maxConnectionAttempts) {
            this.logger.warn(
              `Redis bağlantı denemeleri durduruldu (${times} deneme)`,
            );
            return null; // null döndürerek retry'ı durdur
          }

          // İlk denemelerde hızlı retry
          if (times <= 2) {
            return Math.min(times * 100, 500);
          }
          // Son denemelerde daha uzun bekle
          return Math.min(times * 200, 2000);
        },
        maxRetriesPerRequest: null, // Retry strategy'yi kullan
        enableReadyCheck: true,
        connectTimeout: 5000, // 5 saniye timeout
        lazyConnect: true, // Lazy connect - bağlantıyı hemen kurma
        enableOfflineQueue: false, // Offline queue'yu devre dışı bırak
      });

      // Event listener'ları önce ekle
      this.redisClient.on('connect', () => {
        this.logger.log('Redis client connected');
        this.connectionAttempts = 0; // Başarılı bağlantıda counter'ı sıfırla
      });

      this.redisClient.on('ready', () => {
        this.logger.log(
          `✅ Redis bağlantısı hazır: ${host}:${port} (DB: ${db})`,
        );
        this.connectionAttempts = 0;
      });

      this.redisClient.on('error', (error) => {
        const now = Date.now();
        // Error throttling - 10 saniyede bir log'la
        if (now - this.lastErrorTime > this.errorThrottleMs) {
          this.logger.warn(`Redis bağlantı hatası: ${error.message}`);
          this.lastErrorTime = now;
        }

        this.connectionAttempts++;

        // Çok fazla deneme yapıldıysa client'ı kapat
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
          this.logger.error(
            `Redis bağlantısı ${this.maxConnectionAttempts} kez başarısız oldu. Bağlantı durduruldu.`,
          );
          if (this.redisClient) {
            this.redisClient.disconnect();
            this.redisClient = null;
          }
        }
      });

      this.redisClient.on('close', () => {
        // Sadece ilk kapanışta log'la
        if (this.connectionAttempts < this.maxConnectionAttempts) {
          this.logger.debug('Redis client connection closed');
        }
      });

      // Lazy connect kullandığımız için manuel olarak bağlan
      await this.redisClient.connect();

      // Bağlantıyı test et
      await this.redisClient.ping();
      this.logger.log(
        `✅ Redis bağlantısı başarılı: ${host}:${port} (DB: ${db})`,
      );
    } catch (error) {
      this.logger.error(
        'Redis bağlantısı başarısız:',
        error instanceof Error ? error.message : String(error),
      );
      // Hata durumunda client'ı temizle ama uygulamayı crash etme
      if (this.redisClient) {
        try {
          await this.redisClient.quit();
        } catch (e) {
          // Ignore quit errors
        }
        this.redisClient = null;
      }
      // Error'ı throw etme, sadece log'la
    }
  }

  /**
   * Redis bağlantısını test et
   */
  async testConnection(): Promise<{
    connected: boolean;
    host: string;
    port: number;
    db: number;
    ping: string | null;
    error?: string;
  }> {
    try {
      if (!this.redisClient) {
        await this.initializeRedisClient();
      }

      if (!this.redisClient) {
        throw new Error('Redis client is not initialized');
      }

      const pingResult = await this.redisClient.ping();
      const host =
        this.configService.get<string>('REDIS_HOST') ||
        QueueConfig.connection.host;
      const port =
        this.configService.get<number>('REDIS_PORT') ||
        QueueConfig.connection.port;
      const db =
        this.configService.get<number>('REDIS_DB') || QueueConfig.connection.db;

      return {
        connected: true,
        host,
        port,
        db,
        ping: pingResult,
      };
    } catch (error) {
      const host =
        this.configService.get<string>('REDIS_HOST') ||
        QueueConfig.connection.host;
      const port =
        this.configService.get<number>('REDIS_PORT') ||
        QueueConfig.connection.port;
      const db =
        this.configService.get<number>('REDIS_DB') || QueueConfig.connection.db;

      return {
        connected: false,
        host,
        port,
        db,
        ping: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Queue'nun Redis'teki key'lerini kontrol et
   */
  async checkQueueKeys(queueName: string): Promise<{
    exists: boolean;
    keys: string[];
    jobCounts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
  }> {
    try {
      if (!this.redisClient) {
        await this.initializeRedisClient();
      }

      if (!this.redisClient) {
        return {
          exists: false,
          keys: [],
          jobCounts: {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
          },
        };
      }

      // BullMQ queue key pattern'leri (bull: prefix ile)
      const bullQueueName = `bull:${queueName}`;
      const keyPatterns = [
        `${bullQueueName}:wait`,
        `${bullQueueName}:active`,
        `${bullQueueName}:completed`,
        `${bullQueueName}:failed`,
        `${bullQueueName}:delayed`,
        `${bullQueueName}:meta`,
        `${bullQueueName}:id`,
        `${bullQueueName}:events`,
        `${bullQueueName}:stalled-check`,
      ];

      const keys: string[] = [];
      const jobCounts = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };

      for (const pattern of keyPatterns) {
        const exists = await this.redisClient.exists(pattern);
        if (exists) {
          keys.push(pattern);

          // Job sayılarını al
          if (pattern.includes(':wait')) {
            jobCounts.waiting = await this.redisClient.llen(pattern);
          } else if (pattern.includes(':active')) {
            jobCounts.active = await this.redisClient.llen(pattern);
          } else if (pattern.includes(':completed')) {
            jobCounts.completed = await this.redisClient.zcard(pattern);
          } else if (pattern.includes(':failed')) {
            jobCounts.failed = await this.redisClient.zcard(pattern);
          } else if (pattern.includes(':delayed')) {
            jobCounts.delayed = await this.redisClient.zcard(pattern);
          }
        }
      }

      return {
        exists: keys.length > 0,
        keys,
        jobCounts,
      };
    } catch (error) {
      this.logger.error(`Queue key kontrolü başarısız: ${queueName}`, error);
      return {
        exists: false,
        keys: [],
        jobCounts: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
      };
    }
  }

  /**
   * Redis'teki tüm queue'ları listele
   * BullMQ key formatı: bull:{queue-name}:meta
   */
  async listAllQueues(): Promise<string[]> {
    try {
      if (!this.redisClient) {
        await this.initializeRedisClient();
      }

      if (!this.redisClient) {
        return [];
      }

      // BullMQ key pattern: bull:*:meta
      const keys = await this.redisClient.keys('bull:*:meta');
      const queues = keys.map((key: string) => {
        // bull:test1-queue:meta -> test1-queue
        return key.replace('bull:', '').replace(':meta', '');
      });

      return [...new Set(queues)] as string[];
    } catch (error) {
      this.logger.error('Queue listesi alınamadı:', error);
      return [];
    }
  }

  /**
   * Redis bilgilerini al
   */
  async getRedisInfo(): Promise<{
    version: string;
    connectedClients: number;
    usedMemory: string;
    totalKeys: number;
  }> {
    try {
      if (!this.redisClient) {
        await this.initializeRedisClient();
      }

      if (!this.redisClient) {
        return {
          version: 'unknown',
          connectedClients: 0,
          usedMemory: 'unknown',
          totalKeys: 0,
        };
      }

      const info = await this.redisClient.info();
      const versionMatch = info.match(/redis_version:([^\r\n]+)/);
      const clientsMatch = info.match(/connected_clients:(\d+)/);
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const keyspaceMatch = info.match(/keys=(\d+)/);

      return {
        version: versionMatch ? versionMatch[1] : 'unknown',
        connectedClients: clientsMatch ? parseInt(clientsMatch[1], 10) : 0,
        usedMemory: memoryMatch ? memoryMatch[1] : 'unknown',
        totalKeys: keyspaceMatch ? parseInt(keyspaceMatch[1], 10) : 0,
      };
    } catch (error) {
      this.logger.error('Redis info alınamadı:', error);
      return {
        version: 'unknown',
        connectedClients: 0,
        usedMemory: 'unknown',
        totalKeys: 0,
      };
    }
  }

  /**
   * Redis client'ı kapat
   */
  async disconnect() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
  }
}

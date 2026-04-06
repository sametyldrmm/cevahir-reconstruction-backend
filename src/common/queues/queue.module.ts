import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueConfig } from './queue.types';

/**
 * Queue Module - Redis ve BullMQ yapılandırması
 * Global olarak import edilebilir
 */
@Global()
@Module({})
export class QueueModule {
  /**
   * Queue modülünü yapılandır
   * @param queues - Kayıt edilecek queue isimleri
   */
  static forRoot(queues: string[] = []): DynamicModule {
    return {
      module: QueueModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            // Public URL varsa ve local development'ta ise onu kullan
            const publicUrl = configService.get<string>('REDIS_PUBLIC_URL');
            let host =
              configService.get<string>('REDIS_HOST') ||
              QueueConfig.connection.host;
            let port =
              configService.get<number>('REDIS_PORT') ||
              QueueConfig.connection.port;
            const password =
              configService.get<string>('REDIS_PASSWORD') ||
              QueueConfig.connection.password;
            const db =
              configService.get<number>('REDIS_DB') ||
              QueueConfig.connection.db;

            // Eğer public URL varsa ve host internal ise (local development), public URL'i parse et
            if (publicUrl && host.includes('railway.internal')) {
              try {
                const url = new URL(publicUrl);
                host = url.hostname;
                port = parseInt(url.port, 10);
                console.log(
                  `🌐 BullMQ için Public Redis URL kullanılıyor: ${host}:${port}`,
                );
              } catch (e) {
                console.warn(
                  'Public URL parse edilemedi, default host kullanılıyor',
                );
              }
            }

            return {
              connection: {
                host,
                port,
                password: password || undefined,
                db,
              },
            };
          },
        }),
        ...queues.map((queueName) =>
          BullModule.registerQueue({
            name: queueName,
            defaultJobOptions: QueueConfig.defaultJobOptions,
          }),
        ),
      ],
      exports: [BullModule],
    };
  }

  /**
   * Sadece belirli bir queue için modül oluştur
   */
  static forFeature(queueName: string): DynamicModule {
    return {
      module: QueueModule,
      imports: [
        BullModule.registerQueue({
          name: queueName,
          defaultJobOptions: QueueConfig.defaultJobOptions,
        }),
      ],
      exports: [BullModule],
    };
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getAutoDatabaseConfig } from './railway.config';
import { DataSource } from 'typeorm';
import { CleanLogger } from '../logger';

const typeormBootstrapLogger = new CleanLogger('TypeormModule');

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => {
        // .env dosyası ConfigModule tarafından otomatik yüklenir
        return getAutoDatabaseConfig();
      },
      dataSourceFactory: async (options) => {
        const dataSource = new DataSource({
          ...(options as any),
          synchronize: false,
        });
        await dataSource.initialize();
        await dataSource.query(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'route_points'
                AND column_name = 'recordedAt'
                AND data_type = 'bigint'
            ) THEN
              ALTER TABLE "route_points"
              ALTER COLUMN "recordedAt" TYPE timestamp without time zone
              USING to_timestamp("recordedAt" / 1000.0) + interval '3 hours';
            END IF;
          END $$;
        `);
        try {
          await dataSource.query('CREATE EXTENSION IF NOT EXISTS postgis');
        } catch (error: any) {
          const message = error?.message || 'unknown error';
          typeormBootstrapLogger.warn(
            `PostGIS yok veya etkinleştirilemedi; coğrafi tipler kullanmıyorsanız sorun olmayabilir. Hata: ${message}`,
          );
        }
        await dataSource.synchronize();
        return dataSource;
      },
    }),
  ],
})
export class TypeormModule {}

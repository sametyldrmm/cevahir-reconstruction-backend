import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CleanLogger } from '../logger';

const logger = new CleanLogger('DatabaseConfig');

export const parseDatabaseUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      username: parsed.username,
      password: parsed.password,
      database: parsed.pathname.substring(1),
    };
  } catch (error) {
    logger.error('DATABASE_URL parse error:', error);
    return null;
  }
};

export const getAutoDatabaseConfig = (): TypeOrmModuleOptions => {
  const url = process.env.DATABASE_URL;
  const nodeEnv = process.env.NODE_ENV;

  logger.log('Database Configuration Check (single URL mode)');
  logger.log(`   NODE_ENV: ${nodeEnv || 'not set'}`);
  logger.log(`   DATABASE_URL: ${url ? 'set' : 'not set'}`);

  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Please configure a single PostgreSQL URL.',
    );
  }

  const parsed = parseDatabaseUrl(url);
  if (!parsed) {
    throw new Error('DATABASE_URL could not be parsed.');
  }

  logger.log(
    `PostgreSQL bağlantısı: ${parsed.host}:${parsed.port}/${parsed.database}`,
  );

  const isSsl =
    url.startsWith('postgres://') || url.startsWith('postgresql://');

  return {
    type: 'postgres',
    host: parsed.host,
    port: parsed.port,
    username: parsed.username,
    password: parsed.password,
    database: parsed.database,
    ssl: isSsl ? { rejectUnauthorized: false } : false,
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    synchronize: true,
    dropSchema: false,
    logging: false,
    extra: {
      connectionLimit: 10,
      acquireTimeoutMillis: 60000,
      timeout: 60000,
    },
  };
};

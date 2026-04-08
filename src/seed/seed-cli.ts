import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseSeedService } from './database-seed.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    await app.get(DatabaseSeedService).seedDemoDataIfEmpty();
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildCorsOptions } from './cors-options';
import { getSwaggerUiPath, setupSwagger } from './swagger.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const swaggerPath = getSwaggerUiPath();
  app.setGlobalPrefix('api/v1', {
    exclude: [swaggerPath, `${swaggerPath}-json`],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors(buildCorsOptions());
  setupSwagger(app, swaggerPath);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  const base = `http://127.0.0.1:${port}`;
  Logger.log(`API: ${base}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger: ${base}/${swaggerPath}`, 'Bootstrap');
}
bootstrap();

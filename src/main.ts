import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildCorsOptions } from './cors-options';
import { CleanLogger } from './common/logger';
import { getSwaggerUiPath, setupSwagger } from './swagger.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new CleanLogger(),
  });
  const swaggerPath = getSwaggerUiPath();
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
  const boot = new CleanLogger('Bootstrap');
  boot.log(`API: ${base}`);
  boot.log(`Swagger: ${base}/${swaggerPath}`);
}
bootstrap();

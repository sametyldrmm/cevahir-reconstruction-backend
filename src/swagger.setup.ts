import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Swagger UI: varsayilan `api` (http://host:port/api). SWAGGER_PATH ile degistirilebilir. */
export function getSwaggerUiPath(): string {
  return (process.env.SWAGGER_PATH ?? 'api').replace(/^\/+/, '');
}

export function setupSwagger(
  app: INestApplication,
  uiPath: string = getSwaggerUiPath(),
): void {
  const path = uiPath.replace(/^\/+/, '');

  const config = new DocumentBuilder()
    .setTitle('Cevahir Reconstruction API')
    .setDescription(
      'Santiye / proje oturumu, ilerleme ozet ve detay, admin erisim ve gorunurluk.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'POST /auth/login accessToken',
      },
      'JWT',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(path, app, document);
}

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** UI ve OpenAPI JSON; global api/v1 prefix dışında kalır (main’de exclude ile eşleşmeli). */
export function getSwaggerUiPath(): string {
  return (process.env.SWAGGER_PATH ?? 'docs').replace(/^\/+/, '');
}

export function setupSwagger(
  app: INestApplication,
  uiPath: string = getSwaggerUiPath(),
): void {
  const path = uiPath.replace(/^\/+/, '');

  const config = new DocumentBuilder()
    .setTitle('Cevahir Reconstruction API')
    .setDescription(
      'Şantiye / proje oturumu, ilerleme özet ve detay, admin erişim ve görünürlük uçları.',
    )
    .setVersion('1.0')
    .addTag('app', 'Kök uçlar')
    .addTag('auth', 'Kimlik doğrulama')
    .addTag('session', 'Oturum / çalışma alanı seçimi')
    .addTag('progress', 'İlerleme özeti ve detay')
    .addTag('admin', 'Yönetim (ADMIN rolü)')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        description: 'POST /api/v1/auth/login yanıtındaki accessToken değeri',
      },
      'JWT',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Diğer modüllerle uyum (JWT-auth)',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });

  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Cevahir API — Swagger',
  });
}

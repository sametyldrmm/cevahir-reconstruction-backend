import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * CORS_ORIGINS: virgülle ayrılmış origin listesi; boş veya * → tüm originler (dev).
 * credentials: true kullanıldığında tarayıcı * ile credential izin vermez; prod’da net domain yazın.
 */
export function buildCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGINS?.trim();

  let origin: CorsOptions['origin'] = true;
  if (raw && raw !== '*') {
    const list = raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    origin = list.length === 1 ? list[0]! : list;
  }

  return {
    origin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-Session-Version',
    ],
    exposedHeaders: ['Content-Length'],
    maxAge: 86_400,
  };
}

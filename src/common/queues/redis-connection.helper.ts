/**
 * Redis Connection Helper
 * Redis URL'ini parse edip connection bilgilerine çevirir
 */

export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  url?: string;
}

/**
 * Redis URL'ini parse et
 * Format: redis://[username]:[password]@[host]:[port]/[db]
 * Örnek: redis://default:password@host:6379/0
 */
export function parseRedisUrl(url?: string): RedisConnectionConfig | null {
  if (!url) {
    return null;
  }

  try {
    const redisUrl = new URL(url);
    console.log(redisUrl);
    return {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port || '6379', 10),
      password: redisUrl.password || undefined,
      db: parseInt(redisUrl.pathname?.replace('/', '') || '0', 10),
      url,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Environment variable'larından Redis connection config oluştur
 * Öncelik sırası:
 * 1. REDIS_URL veya REDIS_PUBLIC_URL (URL formatı)
 * 2. REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB (ayrı değişkenler)
 */
export function getRedisConnectionConfig(): RedisConnectionConfig {
  // Önce URL formatını kontrol et
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL;
  if (redisUrl) {
    const parsed = parseRedisUrl(redisUrl);
    if (parsed) {
      return parsed;
    }
  }

  // URL yoksa ayrı değişkenlerden oluştur
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  };
}

/**
 * BullMQ için connection config oluştur
 * BullMQ hem URL hem de ayrı parametreleri kabul eder
 */
export function getBullMQConnectionConfig() {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL;

  // Eğer URL varsa direkt kullan (BullMQ URL'i destekler)
  if (redisUrl) {
    return redisUrl;
  }

  // URL yoksa ayrı parametrelerden oluştur
  const config = getRedisConnectionConfig();
  return {
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
  };
}

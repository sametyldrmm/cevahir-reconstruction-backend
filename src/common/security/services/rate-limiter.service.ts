import { Injectable } from '@nestjs/common';

type RateLimitState = {
  count: number;
  firstRequest: number;
};

type AttemptState = {
  count: number;
  timestamp: number;
};

@Injectable()
export class RateLimiterService {
  private readonly WINDOW_SIZE_IN_SECONDS = 60;
  private readonly MAX_REQUESTS_PER_WINDOW = 100;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly BLACKLIST_DURATION = 24 * 60 * 60 * 1000; // 24 saat

  // Bellek içi depolar (process restart olduğunda sıfırlanır)
  private readonly rateLimits = new Map<string, RateLimitState>();
  private readonly attempts = new Map<string, AttemptState>();
  private readonly blacklist = new Map<string, number>(); // ip -> blacklist bitiş zamanı (timestamp)

  async checkRateLimit(ip: string): Promise<{ success: boolean }> {
    const now = Date.now();

    // Önce blacklist kontrolü
    if (await this.isBlacklisted(ip)) {
      return { success: false };
    }

    const rateLimitKey = `ratelimit:${ip}`;
    const current: RateLimitState = this.rateLimits.get(rateLimitKey) ?? {
      count: 0,
      firstRequest: now,
    };

    // Pencere süresi dolmuşsa sıfırla
    if (now - current.firstRequest > this.WINDOW_SIZE_IN_SECONDS * 1000) {
      current.count = 0;
      current.firstRequest = now;
    }

    current.count += 1;
    this.rateLimits.set(rateLimitKey, current);

    if (current.count > this.MAX_REQUESTS_PER_WINDOW) {
      await this.incrementFailedAttempts(ip);
      return { success: false };
    }

    return { success: true };
  }

  private async incrementFailedAttempts(ip: string): Promise<void> {
    const now = Date.now();
    const attemptKey = `attempt:${ip}`;

    const current: AttemptState = this.attempts.get(attemptKey) ?? {
      count: 0,
      timestamp: now,
    };

    // 5 dakikalık pencere
    if (now - current.timestamp > 5 * 60 * 1000) {
      current.count = 0;
      current.timestamp = now;
    }

    current.count += 1;
    this.attempts.set(attemptKey, current);

    if (current.count >= this.MAX_FAILED_ATTEMPTS) {
      await this.addToBlacklist(ip);
    }
  }

  async addToBlacklist(ip: string): Promise<void> {
    const expiresAt = Date.now() + this.BLACKLIST_DURATION;
    this.blacklist.set(ip, expiresAt);
  }

  async isBlacklisted(ip: string): Promise<boolean> {
    const expiresAt = this.blacklist.get(ip);
    if (!expiresAt) {
      return false;
    }

    // Süresi dolmuşsa listeden çıkar
    if (Date.now() > expiresAt) {
      this.blacklist.delete(ip);
      return false;
    }

    return true;
  }
}

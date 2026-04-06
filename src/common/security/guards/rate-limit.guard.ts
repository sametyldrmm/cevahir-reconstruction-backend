import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RateLimiterService } from '../services/rate-limiter.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiterService: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip =
      request.headers['x-forwarded-for']?.split(',')[0].trim() ||
      request.ip ||
      request.connection.remoteAddress;

    const isBlacklisted = await this.rateLimiterService.isBlacklisted(ip);
    if (isBlacklisted) {
      throw new HttpException(
        'Sisteme diss attın ama otoriteyi yenemezsin! Sahne dışısın.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await this.rateLimiterService.checkRateLimit(ip);
    if (!result.success) {
      throw new HttpException(
        'Sisteme diss attın ama otoriteyi yenemezsin! Sahne dışısın.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

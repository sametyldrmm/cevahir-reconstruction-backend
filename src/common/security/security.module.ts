import { Module } from '@nestjs/common';
import { RateLimiterService } from './services/rate-limiter.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RoleGuard } from './guards/role.guard';
import { PasswordService } from './password.service';

@Module({
  providers: [RateLimiterService, RateLimitGuard, RoleGuard, PasswordService],
  exports: [RateLimiterService, RateLimitGuard, RoleGuard, PasswordService],
})
export class SecurityModule {}

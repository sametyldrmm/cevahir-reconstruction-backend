import { Module } from '@nestjs/common';
import { CommonJwtModule } from '../common/jwt/jwt.module';
import { SecurityModule } from '../common/security/security.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [UsersModule, CommonJwtModule, SecurityModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

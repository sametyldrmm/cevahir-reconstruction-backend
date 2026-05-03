import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { CommonJwtModule } from '../common/jwt/jwt.module';
import { SessionController } from './session.controller';

@Module({
  imports: [AccessModule, CommonJwtModule],
  controllers: [SessionController],
})
export class SessionModule {}

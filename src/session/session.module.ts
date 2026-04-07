import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SessionController } from './session.controller';

@Module({
  imports: [AccessModule],
  controllers: [SessionController],
})
export class SessionModule {}

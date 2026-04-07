import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AccessModule],
  controllers: [AdminController],
})
export class AdminModule {}

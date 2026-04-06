import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailTestController } from './mail-test.controller';

@Module({
  imports: [ConfigModule],
  controllers: [MailTestController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

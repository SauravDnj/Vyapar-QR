import { Module } from '@nestjs/common';

import { smsConfigProvider } from './sms-config.provider';
import { SmsService } from './sms.service';

@Module({
  providers: [smsConfigProvider, SmsService],
  exports: [SmsService],
})
export class SmsModule {}

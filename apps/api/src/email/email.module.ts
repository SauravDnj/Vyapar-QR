import { Module } from '@nestjs/common';

import { emailTransportProvider } from './email-transport.provider';
import { EmailService } from './email.service';

@Module({
  providers: [emailTransportProvider, EmailService],
  exports: [EmailService],
})
export class EmailModule {}

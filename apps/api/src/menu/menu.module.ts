import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [WebhooksModule, EmailModule, WhatsappModule, SmsModule],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}

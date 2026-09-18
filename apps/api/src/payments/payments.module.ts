import { Module } from '@nestjs/common';

import { WebhooksModule } from '../webhooks/webhooks.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [WebhooksModule, WhatsappModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

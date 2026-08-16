import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';

import { WhatsappAiService } from './whatsapp-ai.service';
import { whatsappConfigProvider } from './whatsapp-config.provider';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [AiModule],
  controllers: [WhatsappController, WhatsappWebhookController],
  providers: [whatsappConfigProvider, WhatsappAiService, WhatsappService],
  exports: [WhatsappService, WhatsappAiService],
})
export class WhatsappModule {}

import { Module } from '@nestjs/common';

import { WhatsappModule } from '../whatsapp/whatsapp.module';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [WhatsappModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

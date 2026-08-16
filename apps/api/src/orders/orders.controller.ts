import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { WhatsappService } from '../whatsapp/whatsapp.service';

import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { SendOrderWhatsappDto } from './dto/send-order-whatsapp.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard, PermissionsGuard, PlanFeatureGuard)
@RequirePermission('orders')
@RequireFeature('digitalMenu')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Get()
  list(@CurrentClientId() clientId: string, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(clientId, query);
  }

  @Patch(':id/status')
  updateStatus(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(clientId, id, dto.status);
  }

  @Post(':id/whatsapp')
  async sendWhatsapp(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: SendOrderWhatsappDto) {
    const order = await this.ordersService.findOneOrThrow(clientId, id);
    const sent = await this.whatsappService.sendAndRecord(clientId, order.customerPhone, dto.message);
    return { sent };
  }
}

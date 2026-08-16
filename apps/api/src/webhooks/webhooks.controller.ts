import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
@Roles('client_admin')
@UseGuards(ClientScopeGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  list(@CurrentClientId() clientId: string) {
    return this.webhooksService.list(clientId);
  }

  @Post()
  create(@CurrentClientId() clientId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(clientId, dto.url, dto.eventTypes);
  }

  @Delete(':id')
  remove(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.webhooksService.remove(clientId, id);
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { ConnectWebhookDto, CreateWebhookDto } from './dto/create-webhook.dto';
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

  /** Starts a Google Sheets connection: returns the secret, no URL yet. */
  @Post('sheets')
  prepareSheets(@CurrentClientId() clientId: string) {
    return this.webhooksService.prepareSheets(clientId);
  }

  /** Supplies the deployed web app URL and switches the connection on. */
  @Patch(':id/url')
  connect(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: ConnectWebhookDto) {
    return this.webhooksService.connect(clientId, id, dto.url);
  }

  @Delete(':id')
  remove(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.webhooksService.remove(clientId, id);
  }

  /** Sends a `test` event to one webhook and reports what came back. */
  @Post(':id/test')
  test(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.webhooksService.sendTest(clientId, id);
  }

  /** Sends every existing lead and payment to one webhook. */
  @Post(':id/backfill')
  backfill(@CurrentClientId() clientId: string, @Param('id') id: string) {
    return this.webhooksService.backfill(clientId, id);
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { NotificationsService } from './notifications.service';

@Controller('notifications')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getRecent(@CurrentClientId() clientId: string) {
    return this.notificationsService.getRecent(clientId);
  }
}

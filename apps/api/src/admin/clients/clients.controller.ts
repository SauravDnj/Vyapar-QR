import { Controller, Get, Param, Patch, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { ClientsService } from './clients.service';
import { ListClientsQueryDto } from './dto/list-clients.dto';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';

@Controller('admin/clients')
@Roles('super_admin')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(@Query() query: ListClientsQueryDto) {
    return this.clientsService.list(query);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.clientsService.transition(id, 'approve', user.sub);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.clientsService.transition(id, 'reject', user.sub);
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.clientsService.transition(id, 'suspend', user.sub);
  }

  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.clientsService.transition(id, 'reactivate', user.sub);
  }
}

import { Controller, Get, Param, Patch } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { AgenciesService } from './agencies.service';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';

@Controller('admin/agencies')
@Roles('super_admin')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get()
  list() {
    return this.agenciesService.list();
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.agenciesService.transition(id, 'approve', user.sub);
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.agenciesService.transition(id, 'suspend', user.sub);
  }

  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.agenciesService.transition(id, 'reactivate', user.sub);
  }
}

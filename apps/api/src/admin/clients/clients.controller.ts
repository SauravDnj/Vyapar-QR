import { Body, Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { ClientPlansService } from './client-plans.service';
import { ClientsService } from './clients.service';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { ListClientsQueryDto } from './dto/list-clients.dto';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';

@Controller('admin/clients')
@Roles('super_admin')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly clientPlans: ClientPlansService,
  ) {}

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

  /** The client's current plan and every plan they have had. */
  @Get(':id/plan')
  getPlan(@Param('id') id: string) {
    return this.clientPlans.get(id);
  }

  /** Assign a plan, or switch the client to a different one. */
  @Put(':id/plan')
  assignPlan(@Param('id') id: string, @Body() dto: AssignPlanDto, @CurrentUser() user: JwtPayload) {
    return this.clientPlans.assign(id, dto.planId, user.sub);
  }

  @Patch(':id/plan/deactivate')
  deactivatePlan(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.clientPlans.deactivate(id, user.sub);
  }

  @Patch(':id/plan/activate')
  activatePlan(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.clientPlans.activate(id, user.sub);
  }
}

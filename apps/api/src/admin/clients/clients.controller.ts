import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { ClientAccountsService } from './client-accounts.service';
import { ClientPlansService } from './client-plans.service';
import { ClientsService } from './clients.service';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { CreateClientAccountDto, SetClientPasswordDto } from './dto/client-account.dto';
import { ListClientsQueryDto } from './dto/list-clients.dto';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';

@Controller('admin/clients')
@Roles('super_admin')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly clientPlans: ClientPlansService,
    private readonly clientAccounts: ClientAccountsService,
  ) {}

  @Get()
  list(@Query() query: ListClientsQueryDto) {
    return this.clientsService.list(query);
  }

  /** Open an account for a business: its login, and the business itself. */
  @Post()
  create(@Body() dto: CreateClientAccountDto, @CurrentUser() user: JwtPayload) {
    return this.clientAccounts.create(dto, user.sub);
  }

  /** Give the client's owner a new password. */
  @Put(':id/password')
  setPassword(@Param('id') id: string, @Body() dto: SetClientPasswordDto, @CurrentUser() user: JwtPayload) {
    return this.clientAccounts.setPassword(id, dto.password, user.sub);
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

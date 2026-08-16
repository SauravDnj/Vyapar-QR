import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentAgencyId } from '../common/decorators/current-agency-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AgencyScopeGuard } from '../common/guards/agency-scope.guard';

import { AgencyService } from './agency.service';

@Controller('agency')
@Roles('agency_admin')
@UseGuards(AgencyScopeGuard)
export class AgencyController {
  constructor(private readonly agencyService: AgencyService) {}

  @Get('me')
  getMe(@CurrentAgencyId() agencyId: string) {
    return this.agencyService.getMe(agencyId);
  }

  @Get('stats')
  getStats(@CurrentAgencyId() agencyId: string) {
    return this.agencyService.getStats(agencyId);
  }

  @Get('clients')
  listClients(@CurrentAgencyId() agencyId: string) {
    return this.agencyService.listClients(agencyId);
  }
}

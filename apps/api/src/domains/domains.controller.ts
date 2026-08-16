import { Body, Controller, Get, Put, Post, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';

import { DomainsService } from './domains.service';
import { SetDomainDto } from './dto/set-domain.dto';

@Controller('domains')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard, PermissionsGuard, PlanFeatureGuard)
@RequirePermission('domains')
@RequireFeature('customDomain')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  getStatus(@CurrentClientId() clientId: string) {
    return this.domainsService.getStatus(clientId);
  }

  @Put()
  @Roles('client_admin')
  setDomain(@CurrentClientId() clientId: string, @Body() dto: SetDomainDto) {
    return this.domainsService.setDomain(clientId, dto.domain);
  }

  @Post('verify')
  @Roles('client_admin')
  verify(@CurrentClientId() clientId: string) {
    return this.domainsService.verify(clientId);
  }
}

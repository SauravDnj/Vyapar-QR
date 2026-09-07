import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';

import { VisitorsService } from './visitors.service';

/** The scan side of the CRM: who scanned, when, and who they turned into. */
@Controller('visitors')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard)
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get()
  list(
    @CurrentClientId() clientId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('identifiedOnly') identifiedOnly?: string,
  ) {
    return this.visitorsService.list(clientId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      identifiedOnly: identifiedOnly === 'true',
    });
  }

  @Get('stats')
  stats(@CurrentClientId() clientId: string) {
    return this.visitorsService.stats(clientId);
  }
}

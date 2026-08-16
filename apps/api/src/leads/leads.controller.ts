import { Body, Controller, Get, Header, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WhatsappService } from '../whatsapp/whatsapp.service';

import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { SendLeadWhatsappDto } from './dto/send-lead-whatsapp.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard, PermissionsGuard)
@RequirePermission('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Get()
  list(@CurrentClientId() clientId: string, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.list(clientId, query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="leads.csv"')
  exportCsv(@CurrentClientId() clientId: string) {
    return this.leadsService.exportCsv(clientId);
  }

  @Patch(':id')
  update(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(clientId, id, dto);
  }

  @Post(':id/whatsapp')
  async sendWhatsapp(@CurrentClientId() clientId: string, @Param('id') id: string, @Body() dto: SendLeadWhatsappDto) {
    const lead = await this.leadsService.findOneOrThrow(clientId, id);
    const sent = await this.whatsappService.sendAndRecord(clientId, lead.phone, dto.message);
    return { sent };
  }

  @Post(':id/request-review')
  async requestReview(@CurrentClientId() clientId: string, @Param('id') id: string) {
    const sent = await this.whatsappService.requestReview(clientId, id);
    return { sent };
  }
}

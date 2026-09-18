import { Body, Controller, Get, Header, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { CurrentClientId } from '../common/decorators/current-client-id.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClientScopeGuard } from '../common/guards/client-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@Roles('client_admin', 'client_staff')
@UseGuards(ClientScopeGuard, PermissionsGuard)
@RequirePermission('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list(@CurrentClientId() clientId: string, @Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.list(clientId, query.status);
  }

  @Get('summary')
  summary(@CurrentClientId() clientId: string) {
    return this.paymentsService.getSummary(clientId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="payments.csv"')
  exportCsv(@CurrentClientId() clientId: string) {
    return this.paymentsService.exportCsv(clientId);
  }

  /** The owner marking money as actually received, or as never arrived. */
  @Patch(':id')
  @Roles('client_admin')
  setStatus(
    @CurrentClientId() clientId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.paymentsService.setStatus(clientId, id, dto.status);
  }
}

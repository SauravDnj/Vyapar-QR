import { Controller, Get } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';

import { ReportsService } from './reports.service';

@Controller('admin/reports')
@Roles('super_admin')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('billing')
  getBillingReport() {
    return this.reportsService.getBillingReport();
  }
}

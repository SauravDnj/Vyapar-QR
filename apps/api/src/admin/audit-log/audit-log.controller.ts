import { Controller, Get, Query } from '@nestjs/common';

import { AuditLogService } from '../../audit-log/audit-log.service';
import { Roles } from '../../common/decorators/roles.decorator';

import { ListAuditLogDto } from './dto/list-audit-log.dto';

@Controller('admin/audit-log')
@Roles('super_admin')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Query() query: ListAuditLogDto) {
    return this.auditLogService.list(query);
  }
}

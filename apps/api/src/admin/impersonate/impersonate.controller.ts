import { Controller, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { ImpersonateService } from './impersonate.service';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';

@Controller('admin/clients')
@Roles('super_admin')
export class ImpersonateController {
  constructor(private readonly impersonateService: ImpersonateService) {}

  @Post(':id/impersonate')
  impersonate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.impersonateService.impersonate(id, user.sub);
  }
}

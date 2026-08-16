import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

import type { StaffPermissions } from '@qrhub/types';
import type { Request } from 'express';

/** Must run after `ClientScopeGuard` — reads `request.staffPermissions`,
 * which is always all-true for a `client_admin`, so this only ever actually
 * restricts an invited `client_staff` account (P4-06). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<keyof StaffPermissions | undefined>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { staffPermissions?: StaffPermissions }>();
    if (!request.staffPermissions?.[required]) {
      throw new ForbiddenException(`Your staff account doesn't have access to ${required}.`);
    }
    return true;
  }
}

import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { DEFAULT_STAFF_PERMISSIONS } from '@qrhub/types';

import { PrismaService } from '../../prisma/prisma.service';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import type { StaffPermissions } from '@qrhub/types';
import type { Request } from 'express';


/** Resolves the authenticated user's own Client and attaches its id to the
 * request as `clientId` — client_id is never trusted from request input.
 * `client_admin` resolves via `Client.userId` (unchanged, the original
 * path). `client_staff` (P4-01) has no `Client.userId` of their own —
 * they resolve via an active `ClientStaffMember` row instead.
 *
 * Also attaches `request.staffPermissions` (P4-06): full access for
 * `client_admin`, the staff member's own grants (or the all-true default)
 * for `client_staff`. `PermissionsGuard` reads this afterwards. */
@Injectable()
export class ClientScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload; clientId?: string; staffPermissions?: StaffPermissions }>();
    const user = request.user;

    if (!user || (user.role !== 'client_admin' && user.role !== 'client_staff')) {
      throw new ForbiddenException('Client access only');
    }

    if (user.role === 'client_staff') {
      const membership = await this.prisma.clientStaffMember.findFirst({
        where: { userId: user.sub, status: 'active' },
        select: { clientId: true, permissionsJson: true },
      });
      if (!membership) {
        throw new ForbiddenException('No active staff membership found for this account');
      }
      request.clientId = membership.clientId;
      request.staffPermissions = (membership.permissionsJson as unknown as StaffPermissions | null) ?? DEFAULT_STAFF_PERMISSIONS;
      return true;
    }

    const client = await this.prisma.client.findUnique({
      where: { userId: user.sub },
      select: { id: true },
    });

    if (!client) {
      throw new ForbiddenException('No client profile found for this account');
    }

    request.clientId = client.id;
    request.staffPermissions = DEFAULT_STAFF_PERMISSIONS;
    return true;
  }
}

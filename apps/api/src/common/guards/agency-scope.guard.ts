import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import type { Request } from 'express';

/** Resolves the authenticated `agency_admin`'s own Agency and attaches its
 * id to the request as `agencyId` — never trusted from request input.
 * Mirrors `ClientScopeGuard`. */
@Injectable()
export class AgencyScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload; agencyId?: string }>();
    const user = request.user;

    if (user?.role !== 'agency_admin') {
      throw new ForbiddenException('Agency access only');
    }

    const agency = await this.prisma.agency.findUnique({ where: { userId: user.sub }, select: { id: true } });
    if (!agency) {
      throw new ForbiddenException('No agency profile found for this account');
    }

    request.agencyId = agency.id;
    return true;
  }
}

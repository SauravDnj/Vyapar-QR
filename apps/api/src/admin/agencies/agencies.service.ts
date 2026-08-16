import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { Agency, AgencyStatus } from '@prisma/client';

const TRANSITIONS: Record<string, AgencyStatus> = {
  approve: 'active',
  suspend: 'suspended',
  reactivate: 'active',
};

/** Super Admin management of agency/reseller accounts (P4-05) — mirrors
 * `ClientsService`'s approve/suspend/reactivate pattern. */
@Injectable()
export class AgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  list() {
    return this.prisma.agency.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } }, _count: { select: { clients: true } } },
    });
  }

  async transition(agencyId: string, action: keyof typeof TRANSITIONS, actorId: string): Promise<Agency> {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const nextStatus = TRANSITIONS[action];
    const updated = await this.prisma.agency.update({ where: { id: agencyId }, data: { status: nextStatus } });

    await this.auditLog.record({
      actorId,
      action: `agency.${action}`,
      entity: 'Agency',
      entityId: agencyId,
      meta: { from: agency.status, to: nextStatus },
    });

    return updated;
  }
}

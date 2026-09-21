import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


import { AuditLogService } from '../../audit-log/audit-log.service';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../prisma/prisma.service';

import { ClientPlansService } from './client-plans.service';

import type { ListClientsQueryDto } from './dto/list-clients.dto';
import type { Client, ClientStatus, Prisma } from '../../jsondb';

/** A client row as the Super Admin table shows it: with the plan they are on. */
export type ClientWithPlan = Client & {
  currentPlan: { subscriptionId: string; planId: string; name: string } | null;
};

export interface PaginatedClients {
  data: ClientWithPlan[];
  total: number;
  page: number;
  pageSize: number;
}

const TRANSITIONS: Record<string, ClientStatus> = {
  approve: 'active',
  reject: 'rejected',
  suspend: 'suspended',
  reactivate: 'active',
};

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly clientPlans: ClientPlansService,
  ) {}

  async list(query: ListClientsQueryDto): Promise<PaginatedClients> {
    const where: Prisma.ClientWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { businessName: { contains: query.search } },
              { user: { email: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true } } },
      }),
      this.prisma.client.count({ where }),
    ]);

    const plans = await this.clientPlans.currentFor(data.map((client) => client.id));
    const withPlans: ClientWithPlan[] = data.map((client) => {
      const sub = plans.get(client.id);
      return { ...client, currentPlan: sub ? { subscriptionId: sub.id, planId: sub.planId, name: sub.plan.name } : null };
    });

    return { data: withPlans, total, page: query.page, pageSize: query.pageSize };
  }

  async transition(clientId: string, action: keyof typeof TRANSITIONS, actorId: string): Promise<Client> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, include: { user: true } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const nextStatus = TRANSITIONS[action];
    const wasApproval = action === 'approve' && client.status !== 'active';

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: { status: nextStatus },
    });

    await this.auditLog.record({
      actorId,
      action: `client.${action}`,
      entity: 'Client',
      entityId: clientId,
      meta: { from: client.status, to: nextStatus },
    });

    if (wasApproval) {
      const adminAppUrl = this.configService.get<string>('ADMIN_APP_URL') ?? 'http://localhost:3001';
      await this.emailService.sendClientApproved(client.user.email, client.businessName, `${adminAppUrl}/dashboard`);
    }

    return updated;
  }
}

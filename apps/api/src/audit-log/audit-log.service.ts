import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { Prisma } from '@prisma/client';


interface RecordAuditLogInput {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  meta?: Prisma.InputJsonValue;
}

export interface ListAuditLogQuery {
  page: number;
  pageSize: number;
  entity?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export interface PaginatedAuditLog {
  data: Prisma.AuditLogGetPayload<{ include: { actor: { select: { email: true; role: true } } } }>[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metaJson: input.meta,
      },
    });
  }

  async list(query: ListAuditLogQuery): Promise<PaginatedAuditLog> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.action ? { action: { contains: query.action } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { email: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }
}

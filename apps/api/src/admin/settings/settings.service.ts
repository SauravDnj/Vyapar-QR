import { Injectable } from '@nestjs/common';


import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { Prisma } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async getOne(key: string): Promise<unknown> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value;
  }

  async updateMany(values: Record<string, unknown>, actorId: string): Promise<Record<string, unknown>> {
    await this.prisma.$transaction(
      Object.entries(values).map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        }),
      ),
    );

    await this.auditLog.record({
      actorId,
      action: 'settings.update',
      entity: 'Setting',
      entityId: Object.keys(values).join(','),
      meta: values as Prisma.InputJsonValue,
    });

    return this.getAll();
  }
}

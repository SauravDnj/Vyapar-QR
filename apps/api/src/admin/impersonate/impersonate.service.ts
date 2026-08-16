import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';


import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import type ms from 'ms';

const IMPERSONATION_DURATION = '30m';

@Injectable()
export class ImpersonateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  async impersonate(clientId: string, actorId: string): Promise<{ accessToken: string; expiresIn: string }> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { user: true },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const payload: JwtPayload = {
      sub: client.user.id,
      email: client.user.email,
      role: client.user.role,
      impersonatedBy: actorId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: IMPERSONATION_DURATION as ms.StringValue,
    });

    await this.auditLog.record({
      actorId,
      action: 'client.impersonate',
      entity: 'Client',
      entityId: clientId,
    });

    return { accessToken, expiresIn: IMPERSONATION_DURATION };
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

import { ClientPlansService } from './client-plans.service';

import type { CreateClientAccountDto } from './dto/client-account.dto';
import type { Client } from '../../jsondb';

const BCRYPT_ROUNDS = 10;

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'business'
  );
}

/**
 * Client logins, as the Super Admin manages them: open an account for a
 * business, and set a new password on one.
 *
 * An account opened here skips the two steps a self-signup goes through —
 * it is active straight away (the Super Admin *is* the approval) and its
 * business already exists, so the owner signs in and lands on choosing a
 * theme, exactly where a self-signup would be after entering the name.
 *
 * Passwords are only ever stored hashed and never written to the audit log;
 * the Super Admin sees the one they typed, once, to pass on.
 */
@Injectable()
export class ClientAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly clientPlans: ClientPlansService,
  ) {}

  async create(dto: CreateClientAccountDto, actorId: string): Promise<Client & { user: { email: string } }> {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('An account with this email already exists.');
    }

    // Checked before anything is written, so a bad plan can't leave a
    // half-made account behind.
    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new NotFoundException('That plan no longer exists.');
      if (plan.isArchived) throw new BadRequestException('That plan is archived — pick another.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const slug = await this.uniqueSlug(dto.businessName);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'client_admin',
        status: 'active',
        client: { create: { businessName: dto.businessName, slug, status: 'active' } },
      },
    });

    const client = await this.prisma.client.findUnique({ where: { userId: user.id } });
    if (!client) {
      throw new Error('The client record was not created.');
    }
    await this.prisma.landingPage.create({
      data: { clientId: client.id, contentJson: { hero: { headline: dto.businessName } } },
    });

    await this.auditLog.record({
      actorId,
      action: 'client.created',
      entity: 'Client',
      entityId: client.id,
      meta: { email, businessName: dto.businessName },
    });

    if (dto.planId) {
      await this.clientPlans.assign(client.id, dto.planId, actorId);
    }

    return { ...client, user: { email } };
  }

  /**
   * Replaces the client owner's password. Their current sessions are ended
   * (the refresh token is cleared), so whoever had the old password is signed
   * out the next time their page asks for a fresh token.
   */
  async setPassword(clientId: string, password: string, actorId: string): Promise<{ email: string }> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, include: { user: true } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: client.userId },
      data: { passwordHash, hashedRefreshToken: null },
    });

    await this.auditLog.record({
      actorId,
      action: 'client.password_set',
      entity: 'Client',
      entityId: clientId,
      meta: { email: client.user.email },
    });

    return { email: client.user.email };
  }

  private async uniqueSlug(businessName: string): Promise<string> {
    const base = slugify(businessName);
    let candidate = base;
    let suffix = 2;
    while (await this.prisma.client.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${String(suffix)}`;
      suffix += 1;
    }
    return candidate;
  }
}

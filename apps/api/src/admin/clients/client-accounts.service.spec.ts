import { join } from 'node:path';

import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { JsonDbClient } from '../../jsondb/client';
import { MemoryDriver } from '../../jsondb/drivers/memory';

import { ClientAccountsService } from './client-accounts.service';
import { ClientPlansService } from './client-plans.service';

import type { AuditLogService } from '../../audit-log/audit-log.service';
import type { PrismaService } from '../../prisma/prisma.service';

const SCHEMA = join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma');

async function setup() {
  const db = new JsonDbClient({ driver: new MemoryDriver(), schemaPath: SCHEMA });
  const record = jest.fn().mockResolvedValue(undefined);
  const audit = { record } as unknown as AuditLogService;
  const prisma = db as unknown as PrismaService;
  const service = new ClientAccountsService(prisma, audit, new ClientPlansService(prisma, audit));
  const pro = await db.plan.create({
    data: {
      name: 'Pro',
      price: 999,
      billingCycle: 'monthly',
      maxThemes: 1,
      customDomainAllowed: false,
      featuresJson: { analytics: true, customDomain: false, whiteLabel: false, digitalMenu: false },
    },
  });
  return { db, service, record, pro };
}

const input = { email: 'Owner@Shop.in ', password: 'Welcome123', businessName: 'Kalyani Jewellers' };

describe('ClientAccountsService', () => {
  it('opens a working, already-approved account with its business and page', async () => {
    const { db, service } = await setup();

    const created = await service.create(input, 'admin-1');

    const user = await db.user.findUnique({ where: { email: 'owner@shop.in' } });
    expect(user?.role).toBe('client_admin');
    expect(user?.status).toBe('active');
    expect(await bcrypt.compare('Welcome123', user?.passwordHash ?? '')).toBe(true);
    expect(created.status).toBe('active');
    expect(created.slug).toBe('kalyani-jewellers');
    expect(created.user.email).toBe('owner@shop.in');
    const page = await db.landingPage.findUnique({ where: { clientId: created.id } });
    expect(page?.contentJson).toEqual({ hero: { headline: 'Kalyani Jewellers' } });
  });

  it('gives a second business with the same name its own address', async () => {
    const { service } = await setup();
    await service.create(input, 'admin-1');
    const second = await service.create({ ...input, email: 'other@shop.in' }, 'admin-1');
    expect(second.slug).toBe('kalyani-jewellers-2');
  });

  it('refuses an email that already has an account, whatever its case', async () => {
    const { service } = await setup();
    await service.create(input, 'admin-1');
    await expect(service.create({ ...input, email: 'OWNER@shop.in' }, 'admin-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('puts the client on a plan when one is chosen', async () => {
    const { db, service, pro } = await setup();
    const created = await service.create({ ...input, planId: pro.id }, 'admin-1');
    const sub = await db.subscription.findFirst({ where: { clientId: created.id, status: 'active' } });
    expect(sub?.planId).toBe(pro.id);
  });

  it('writes nothing when the chosen plan does not exist', async () => {
    const { db, service } = await setup();
    await expect(service.create({ ...input, planId: 'gone' }, 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(await db.user.findUnique({ where: { email: 'owner@shop.in' } })).toBeNull();
  });

  it('sets a new password, signs the old sessions out, and never logs the password', async () => {
    const { db, service, record } = await setup();
    const created = await service.create(input, 'admin-1');
    await db.user.update({ where: { id: created.userId }, data: { hashedRefreshToken: 'old-session' } });

    await service.setPassword(created.id, 'BrandNew456', 'admin-1');

    const user = await db.user.findUnique({ where: { id: created.userId } });
    expect(await bcrypt.compare('BrandNew456', user?.passwordHash ?? '')).toBe(true);
    expect(await bcrypt.compare('Welcome123', user?.passwordHash ?? '')).toBe(false);
    expect(user?.hashedRefreshToken).toBeNull();
    expect(record).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'client.password_set' }));
    expect(JSON.stringify(record.mock.calls)).not.toMatch(/Welcome123|BrandNew456/);
  });

  it('refuses to set a password on a client that does not exist', async () => {
    const { service } = await setup();
    await expect(service.setPassword('nobody', 'BrandNew456', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

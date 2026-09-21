import { join } from 'node:path';

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { JsonDbClient } from '../../jsondb/client';
import { MemoryDriver } from '../../jsondb/drivers/memory';

import { ClientPlansService } from './client-plans.service';

import type { AuditLogService } from '../../audit-log/audit-log.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Runs against the real JSON engine on its in-memory driver rather than a
 * mocked Prisma, so the parts that matter — `updateMany` with an `in` filter,
 * the `include`, newest-first ordering — behave exactly as they do in
 * production.
 */
const SCHEMA = join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma');

async function setup() {
  const db = new JsonDbClient({ driver: new MemoryDriver(), schemaPath: SCHEMA });
  const record = jest.fn().mockResolvedValue(undefined);
  const service = new ClientPlansService(db as unknown as PrismaService, { record } as unknown as AuditLogService);

  const user = await db.user.create({ data: { email: 'owner@shop.in', passwordHash: 'x', role: 'client_admin' } });
  const client = await db.client.create({
    data: { userId: user.id, businessName: 'Kalyani Jewellers', slug: 'kalyani', status: 'active' },
  });
  const plan = (name: string, over: Record<string, unknown> = {}) =>
    db.plan.create({
      data: {
        name,
        price: 0,
        billingCycle: 'monthly',
        maxThemes: 1,
        customDomainAllowed: false,
        featuresJson: { analytics: false, customDomain: false, whiteLabel: false, digitalMenu: false },
        ...over,
      },
    });
  const basic = await plan('Basic');
  const pro = await plan('Pro', { price: 999, featuresJson: { analytics: true, customDomain: true, whiteLabel: true, digitalMenu: true } });

  /** What every feature gate reads: the newest active subscription's plan. */
  const planSeenByFeatureGates = async () => {
    const sub = await db.subscription.findFirst({
      where: { clientId: client.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    return (sub as { plan?: { name: string } } | null)?.plan?.name ?? null;
  };

  return { db, service, record, client, basic, pro, plan, planSeenByFeatureGates };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('ClientPlansService', () => {
  it('assigns a plan to a client who had none, and the feature gates see it', async () => {
    const { service, record, client, pro, planSeenByFeatureGates } = await setup();

    const state = await service.assign(client.id, pro.id, 'admin-1');

    expect(state.current?.plan.name).toBe('Pro');
    expect(state.current?.status).toBe('active');
    expect(await planSeenByFeatureGates()).toBe('Pro');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'plan.assigned', entityId: client.id }),
    );
  });

  it('switches plans, keeping the old one as history rather than editing it', async () => {
    const { service, record, client, basic, pro, planSeenByFeatureGates } = await setup();
    await service.assign(client.id, basic.id, 'admin-1');
    await tick();

    const state = await service.assign(client.id, pro.id, 'admin-1');

    expect(state.current?.plan.name).toBe('Pro');
    expect(state.history.map((sub) => [sub.plan.name, sub.status])).toEqual([
      ['Pro', 'active'],
      ['Basic', 'cancelled'],
    ]);
    expect(await planSeenByFeatureGates()).toBe('Pro');
    const calls = record.mock.calls as [{ action: string; meta: { from: string; to: string } }][];
    const last = calls.at(-1)?.[0];
    expect(last?.action).toBe('plan.switched');
    expect(last?.meta).toMatchObject({ from: 'Basic', to: 'Pro' });
  });

  it('closes an abandoned Razorpay checkout so the overdue sweep cannot suspend the client', async () => {
    const { db, service, client, basic, pro } = await setup();
    // What a checkout that was started and never paid leaves behind.
    await db.subscription.create({
      data: { clientId: client.id, planId: basic.id, status: 'pending', currentPeriodEnd: new Date('2026-01-01') },
    });

    await service.assign(client.id, pro.id, 'admin-1');

    // The exact query `BillingService.suspendOverdueClients` runs.
    const overdue = await db.subscription.findMany({
      where: { clientId: client.id, status: { in: ['past_due', 'pending'] } },
    });
    expect(overdue).toHaveLength(0);
  });

  it('refuses to assign the plan the client is already on', async () => {
    const { service, client, pro } = await setup();
    await service.assign(client.id, pro.id, 'admin-1');
    await expect(service.assign(client.id, pro.id, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to assign an archived plan', async () => {
    const { service, client, plan } = await setup();
    const old = await plan('Legacy', { isArchived: true });
    await expect(service.assign(client.id, old.id, 'admin-1')).rejects.toThrow(/archived/);
  });

  it('refuses a plan or client that does not exist', async () => {
    const { service, client, pro } = await setup();
    await expect(service.assign(client.id, 'no-such-plan', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.assign('no-such-client', pro.id, 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deactivates a plan so no feature gate sees one, then activates it again', async () => {
    const { service, record, client, pro, planSeenByFeatureGates } = await setup();
    await service.assign(client.id, pro.id, 'admin-1');

    const off = await service.deactivate(client.id, 'admin-1');
    expect(off.current).toBeNull();
    expect(await planSeenByFeatureGates()).toBeNull();
    expect(record).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'plan.deactivated' }));

    const on = await service.activate(client.id, 'admin-1');
    expect(on.current?.plan.name).toBe('Pro');
    expect(await planSeenByFeatureGates()).toBe('Pro');
    expect(record).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'plan.activated' }));
  });

  it('leaves the client itself live when their plan is deactivated', async () => {
    const { db, service, client, pro } = await setup();
    await service.assign(client.id, pro.id, 'admin-1');
    await service.deactivate(client.id, 'admin-1');
    expect((await db.client.findUnique({ where: { id: client.id } }))?.status).toBe('active');
  });

  it('explains what to do instead when activate or deactivate cannot apply', async () => {
    const { service, client, pro } = await setup();
    await expect(service.deactivate(client.id, 'admin-1')).rejects.toThrow(/no active plan/);
    await expect(service.activate(client.id, 'admin-1')).rejects.toThrow(/never had a plan/);

    await service.assign(client.id, pro.id, 'admin-1');
    await expect(service.activate(client.id, 'admin-1')).rejects.toThrow(/already has an active plan/);
  });

  it('will not reactivate a plan that was archived after it was switched off', async () => {
    const { db, service, client, pro } = await setup();
    await service.assign(client.id, pro.id, 'admin-1');
    await service.deactivate(client.id, 'admin-1');
    await db.plan.update({ where: { id: pro.id }, data: { isArchived: true } });

    await expect(service.activate(client.id, 'admin-1')).rejects.toThrow(/archived/);
  });

  it('reports the current plan of many clients in one call, for the clients table', async () => {
    const { db, service, client, pro } = await setup();
    const user2 = await db.user.create({ data: { email: 'b@shop.in', passwordHash: 'x', role: 'client_admin' } });
    const other = await db.client.create({ data: { userId: user2.id, businessName: 'No Plan Co', slug: 'noplan', status: 'active' } });
    await service.assign(client.id, pro.id, 'admin-1');

    const current = await service.currentFor([client.id, other.id]);
    expect(current.get(client.id)?.plan.name).toBe('Pro');
    expect(current.has(other.id)).toBe(false);
  });
});

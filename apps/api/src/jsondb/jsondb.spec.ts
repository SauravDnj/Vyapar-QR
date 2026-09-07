import { join } from 'node:path';

import { JsonDbClient } from './client';
import { MemoryDriver } from './drivers/memory';

import type { Client } from './generated/models';

const SCHEMA = join(__dirname, '..', '..', 'prisma', 'schema.prisma');

function makeClient(): JsonDbClient {
  return new JsonDbClient({ driver: new MemoryDriver(), schemaPath: SCHEMA });
}

describe('JsonDbClient', () => {
  let db: JsonDbClient;

  beforeEach(() => {
    db = makeClient();
  });

  describe('schema parsing', () => {
    it('parses every model and enum from the real schema', () => {
      expect(db.schema.models.size).toBe(34);
      expect(db.schema.enums.get('UserRole')).toEqual([
        'super_admin',
        'client_admin',
        'client_staff',
        'agency_admin',
      ]);
    });

    it('resolves relations from both sides', () => {
      const client = db.schema.models.get('Client');
      expect(client?.fieldsByName.get('user')?.relation).toMatchObject({
        fields: ['userId'],
        references: ['id'],
        onDelete: 'Cascade',
      });
      expect(client?.fieldsByName.get('landingPage')?.backRelation).toEqual({
        model: 'LandingPage',
        field: 'client',
      });
    });
  });

  describe('create', () => {
    it('applies uuid, now and literal defaults', async () => {
      const user = await db.user.create({
        data: { email: 'a@b.com', passwordHash: 'x', role: 'super_admin' },
      });

      expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(user.status).toBe('active');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.hashedRefreshToken).toBeNull();
    });

    it('enforces single-field unique constraints', async () => {
      const data = { email: 'dupe@b.com', passwordHash: 'x', role: 'client_admin' };
      await db.user.create({ data });

      await expect(db.user.create({ data })).rejects.toMatchObject({ code: 'P2002' });
    });

    it('enforces composite unique constraints', async () => {
      const client = await seedClient(db, 'acme');
      const base = {
        clientId: client.id,
        code: 'SAVE10',
        description: 'Ten percent off',
        discountText: '10% off',
      };
      await db.coupon.create({ data: base });

      await expect(db.coupon.create({ data: base })).rejects.toMatchObject({
        code: 'P2002',
      });
      // Same code under a different client is allowed.
      const other = await seedClient(db, 'other');
      await expect(
        db.coupon.create({ data: { ...base, clientId: other.id } }),
      ).resolves.toBeDefined();
    });
  });

  describe('nested writes', () => {
    it('creates a related row and links it back', async () => {
      // The shape `auth.service.ts` uses for agency signup. Silently dropping
      // this created an agency_admin user with no Agency row.
      const user = await db.user.create({
        data: {
          email: 'agency@b.com',
          passwordHash: 'x',
          role: 'agency_admin',
          agency: { create: { name: 'Acme Agency', slug: 'acme-agency' } },
        },
      });

      const agencies = await db.agency.findMany({ where: { userId: user.id } });
      expect(agencies).toHaveLength(1);
      expect(agencies[0].name).toBe('Acme Agency');
      expect(agencies[0].slug).toBe('acme-agency');

      const withAgency = await db.user.findUnique({
        where: { id: user.id },
        include: { agency: true },
      });
      expect(withAgency?.agency?.slug).toBe('acme-agency');
    });

    it('rejects nested writes it cannot honour, rather than dropping them', async () => {
      await expect(
        db.user.create({
          data: {
            email: 'x@b.com',
            passwordHash: 'x',
            role: 'agency_admin',
            agency: { connect: { id: 'whatever' } },
          },
        }),
      ).rejects.toThrow(/unsupported nested write/);
    });
  });

  describe('read', () => {
    beforeEach(async () => {
      for (const [i, name] of ['delta', 'alpha', 'charlie', 'bravo'].entries()) {
        await db.plan.create({
          data: {
            name,
            price: (i + 1) * 100,
            billingCycle: 'monthly',
            featuresJson: { seats: i },
            maxThemes: i,
          },
        });
      }
    });

    it('filters, orders, and paginates', async () => {
      const rows = await db.plan.findMany({
        where: { price: { gte: 200 } },
        orderBy: { name: 'asc' },
        skip: 1,
        take: 2,
      });
      expect(rows.map((r) => r.name)).toEqual(['bravo', 'charlie']);
    });

    it('supports string operators and case-insensitive mode', async () => {
      const rows = await db.plan.findMany({
        where: { name: { contains: 'AL', mode: 'insensitive' } },
      });
      expect(rows.map((r) => r.name)).toEqual(['alpha']);
    });

    it('supports AND / OR / NOT', async () => {
      const rows = await db.plan.findMany({
        where: {
          OR: [{ name: 'alpha' }, { name: 'bravo' }],
          NOT: { name: 'bravo' },
        },
      });
      expect(rows.map((r) => r.name)).toEqual(['alpha']);
    });

    it('counts and aggregates', async () => {
      expect(await db.plan.count({ where: { price: { lt: 300 } } })).toBe(2);
      const agg = await db.plan.aggregate({ _sum: { price: true }, _avg: { price: true } });
      expect(agg._sum).toEqual({ price: 1000 });
      expect(agg._avg).toEqual({ price: 250 });
    });

    it('groups by a field', async () => {
      const groups = await db.plan.groupBy({
        by: ['billingCycle'],
        _count: true,
        _sum: { price: true },
      });
      expect(groups).toEqual([
        { billingCycle: 'monthly', _count: 4, _sum: { price: 1000 } },
      ]);
    });

    it('throws P2025 from findUniqueOrThrow when absent', async () => {
      await expect(
        db.plan.findUniqueOrThrow({ where: { id: 'nope' } }),
      ).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  describe('relations', () => {
    it('includes a to-one relation from the FK side', async () => {
      const client = await seedClient(db, 'acme');
      const found = await db.client.findUnique({
        where: { id: client.id },
        include: { user: true },
      });
      expect(found?.user.email).toBe('acme@b.com');
    });

    it('includes a to-many relation from the virtual side', async () => {
      const client = await seedClient(db, 'acme');
      for (const name of ['Lead A', 'Lead B']) {
        await db.lead.create({
          data: { clientId: client.id, name, source: 'contact_form' },
        });
      }
      const withLeads = await db.client.findUnique({
        where: { id: client.id },
        include: { leads: { orderBy: { name: 'desc' } } },
      });
      expect(withLeads?.leads.map((l) => l.name)).toEqual([
        'Lead B',
        'Lead A',
      ]);
    });

    it('honours select, nested select and _count', async () => {
      const client = await seedClient(db, 'acme');
      await db.lead.create({
        data: { clientId: client.id, name: 'Only', source: 'contact_form' },
      });

      const row = await db.client.findUnique({
        where: { id: client.id },
        select: {
          businessName: true,
          user: { select: { email: true } },
          _count: { select: { leads: true } },
        },
      });
      expect(row).toEqual({
        businessName: 'acme',
        user: { email: 'acme@b.com' },
        _count: { leads: 1 },
      });
    });
  });

  describe('update', () => {
    it('sets updatedAt and applies atomic increments', async () => {
      const client = await seedClient(db, 'acme');
      const before = client.updatedAt;
      await new Promise((r) => setTimeout(r, 5));

      const updated = await db.client.update({
        where: { id: client.id },
        data: { businessName: 'acme renamed' },
      });
      expect(updated.businessName).toBe('acme renamed');
      expect((updated.updatedAt).getTime()).toBeGreaterThan(before.getTime());

      const coupon = await db.coupon.create({
        data: {
          clientId: client.id,
          code: 'X',
          description: 'Five percent off',
          discountText: '5% off',
        },
      });
      const bumped = await db.coupon.update({
        where: { id: coupon.id },
        data: { redemptionCount: { increment: 3 } },
      });
      expect(bumped.redemptionCount).toBe(3);
    });

    it('upserts — creating then updating the same unique row', async () => {
      const created = await db.plan.upsert({
        where: { id: 'plan-1' },
        create: {
          name: 'Starter',
          price: 99,
          billingCycle: 'monthly',
          featuresJson: {},
          maxThemes: 1,
        },
        update: { name: 'unused' },
      });
      expect(created.id).toBe('plan-1');
      expect(created.name).toBe('Starter');

      const updated = await db.plan.upsert({
        where: { id: 'plan-1' },
        create: {
          name: 'Starter',
          price: 99,
          billingCycle: 'monthly',
          featuresJson: {},
          maxThemes: 1,
        },
        update: { name: 'Starter Plus' },
      });
      expect(updated.name).toBe('Starter Plus');
      expect(await db.plan.count()).toBe(1);
    });

    it('updateMany reports an accurate count', async () => {
      const client = await seedClient(db, 'acme');
      for (const name of ['a', 'b', 'c']) {
        await db.lead.create({
          data: { clientId: client.id, name, source: 'contact_form' },
        });
      }
      const result = await db.lead.updateMany({
        where: { name: { in: ['a', 'c'] } },
        data: { status: 'contacted' },
      });
      expect(result).toEqual({ count: 2 });
      expect(await db.lead.count({ where: { status: 'contacted' } })).toBe(2);
    });
  });

  describe('delete', () => {
    it('cascades to dependent rows', async () => {
      const client = await seedClient(db, 'acme');
      await db.lead.create({
        data: { clientId: client.id, name: 'L', source: 'contact_form' },
      });
      expect(await db.lead.count()).toBe(1);

      // Deleting the user cascades to the client, which cascades to leads.
      await db.user.delete({ where: { id: client.userId } });

      expect(await db.client.count()).toBe(0);
      expect(await db.lead.count()).toBe(0);
    });

    it('applies SetNull instead of deleting', async () => {
      const theme = await db.theme.create({
        data: { name: 'Basic', slug: 'basic', configJson: {}, previewImageUrl: null },
      });
      const client = await seedClient(db, 'acme', { themeId: theme.id });

      await db.theme.delete({ where: { id: theme.id } });

      const after = await db.client.findUnique({ where: { id: client.id } });
      expect(after).not.toBeNull();
      expect(after?.themeId).toBeNull();
    });

    it('throws P2025 when deleting a missing row', async () => {
      await expect(db.plan.delete({ where: { id: 'ghost' } })).rejects.toMatchObject({
        code: 'P2025',
      });
    });
  });

  describe('durability', () => {
    it('round-trips through the driver, reviving Dates', async () => {
      const driver = new MemoryDriver();
      const first = new JsonDbClient({ driver, schemaPath: SCHEMA });
      await first.user.create({
        data: { email: 'persist@b.com', passwordHash: 'x', role: 'super_admin' },
      });

      // A second client over the same driver sees the committed rows.
      const second = new JsonDbClient({ driver, schemaPath: SCHEMA });
      const found = await second.user.findUnique({ where: { email: 'persist@b.com' } });

      expect(found).not.toBeNull();
      expect(found?.createdAt).toBeInstanceOf(Date);
      expect(found?.role).toBe('super_admin');
    });

    it('serialises concurrent writes without losing any', async () => {
      const client = await seedClient(db, 'acme');
      await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          db.lead.create({
            data: { clientId: client.id, name: `L${String(i)}`, source: 'contact_form' },
          }),
        ),
      );
      expect(await db.lead.count()).toBe(25);
    });
  });

  describe('unsupported operations fail loudly', () => {
    it('rejects raw SQL rather than returning wrong data', () => {
      expect(() => db.$queryRaw()).toThrow(/raw SQL is not supported/);
    });

    it('rejects relation filters in where', async () => {
      await seedClient(db, 'acme');
      await expect(
        db.client.findMany({ where: { leads: { some: { name: 'x' } } } }),
      ).rejects.toThrow(/relation filter/);
    });
  });
});

async function seedClient(
  db: JsonDbClient,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<Client & Record<string, any>> {
  const user = await db.user.create({
    data: { email: `${name}@b.com`, passwordHash: 'x', role: 'client_admin' },
  });
  return db.client.create({
    data: {
      userId: user.id,
      businessName: name,
      slug: name,
      ...extra,
    },
  });
}

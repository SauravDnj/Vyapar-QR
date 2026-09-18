import { PaymentsService } from './payments.service';

import type { PrismaService } from '../prisma/prisma.service';
import type { WebhooksService } from '../webhooks/webhooks.service';
import type { WhatsappService } from '../whatsapp/whatsapp.service';
import type { ConfigService } from '@nestjs/config';

/**
 * A UPI deep link reports nothing back, so every row here is what the
 * customer *said* they paid. These tests pin the two things that follow from
 * that: a claim is never recorded as confirmed money, and cancelled claims
 * never reach a total the owner might act on.
 */
function makeService(overrides: {
  claims?: unknown[];
  leads?: unknown[];
  created?: unknown[];
  updated?: unknown[];
}) {
  const created = overrides.created ?? [];
  const updated = overrides.updated ?? [];
  const leads = overrides.leads ?? [];

  const leadCreate = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
    leads.push({ id: 'lead-1', ...data });
    return Promise.resolve({ id: 'lead-1', ...data });
  });

  const prisma = {
    client: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', businessName: 'Shree Gold', googleReviewConfig: null }) },
    lead: {
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(leads[0] ?? null)),
      create: leadCreate,
    },
    paymentClaim: {
      findMany: jest.fn().mockResolvedValue(overrides.claims ?? []),
      findFirst: jest.fn().mockResolvedValue((overrides.claims ?? [])[0] ?? null),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const row = { id: 'claim-1', createdAt: new Date(), status: 'claimed', ...data };
        created.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn().mockImplementation((args: Record<string, unknown>) => {
        updated.push(args);
        return Promise.resolve({ id: 'claim-1' });
      }),
    },
    analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService;

  const whatsapp = { resolveSend: jest.fn().mockResolvedValue({ sent: false, url: null }) } as unknown as WhatsappService;
  const webhooks = { dispatch: jest.fn().mockResolvedValue(undefined) } as unknown as WebhooksService;
  const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

  return { service: new PaymentsService(prisma, whatsapp, webhooks, config), leadCreate, created, updated, leads };
}

const claim = (over: Partial<{ amount: number | null; status: string; method: string; createdAt: Date }>) => ({
  id: Math.random().toString(36).slice(2),
  amount: 100,
  method: 'gpay',
  status: 'claimed',
  createdAt: new Date(),
  customerName: null,
  customerPhone: null,
  note: null,
  leadId: null,
  ...over,
});

describe('PaymentsService.claim', () => {
  it('records a claim, never a confirmed payment', async () => {
    const { service, created } = makeService({});
    await service.claim('shree', { amount: 250, method: 'phonepe' });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ amount: 250, method: 'phonepe', status: 'claimed' });
  });

  it('accepts a payment with no amount, because the customer can type it in the app', async () => {
    const { service, created } = makeService({});
    const result = await service.claim('shree', { method: 'other' });

    expect(result.claimId).toBe('claim-1');
    expect(created[0]).toMatchObject({ amount: null, method: 'other' });
  });

  it('creates a CRM lead when the customer leaves a number', async () => {
    const { service, leads, created } = makeService({});
    await service.claim('shree', { amount: 100, method: 'gpay', name: 'Asha', phone: '+919000000001' });

    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ name: 'Asha', phone: '+919000000001', source: 'payment_claim' });
    expect(created[0]).toMatchObject({ leadId: 'lead-1' });
  });

  it('reuses the existing contact instead of duplicating them', async () => {
    const { service, leadCreate, leads } = makeService({ leads: [{ id: 'lead-existing', phone: '+919000000001' }] });
    await service.claim('shree', { amount: 100, method: 'gpay', phone: '+919000000001' });

    expect(leadCreate).not.toHaveBeenCalled();
    expect(leads).toHaveLength(1);
  });

  it('writes nothing when the honeypot is filled', async () => {
    const { service, created } = makeService({});
    const result = await service.claim('shree', { amount: 100, website: 'bot' });

    expect(created).toHaveLength(0);
    expect(result.claimId).toBeNull();
  });
});

describe('PaymentsService.getSummary', () => {
  it('leaves cancelled claims out of every total', async () => {
    const { service } = makeService({
      claims: [claim({ amount: 100 }), claim({ amount: 500, status: 'cancelled' }), claim({ amount: 50, status: 'confirmed' })],
    });

    const summary = await service.getSummary('c1');
    expect(summary.allTimeTotal).toBe(150);
    expect(summary.todayTotal).toBe(150);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.confirmedCount).toBe(1);
  });

  it('counts a payment with no amount without breaking the total', async () => {
    const { service } = makeService({ claims: [claim({ amount: null }), claim({ amount: 75 })] });

    const summary = await service.getSummary('c1');
    expect(summary.allTimeTotal).toBe(75);
    expect(summary.byMethod[0]).toMatchObject({ method: 'gpay', count: 2, total: 75 });
  });

  it('only counts the last 7 and 30 days in those totals', async () => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { service } = makeService({
      claims: [claim({ amount: 10, createdAt: daysAgo(1) }), claim({ amount: 20, createdAt: daysAgo(10) }), claim({ amount: 40, createdAt: daysAgo(60) })],
    });

    const summary = await service.getSummary('c1');
    expect(summary.weekTotal).toBe(10);
    expect(summary.monthTotal).toBe(30);
    expect(summary.allTimeTotal).toBe(70);
  });
});

describe('PaymentsService.exportCsv', () => {
  it('starts with a byte-order mark so Excel reads rupees and Hindi correctly', async () => {
    const { service } = makeService({ claims: [claim({ amount: 100 })] });
    expect((await service.exportCsv('c1')).codePointAt(0)).toBe(0xfeff);
  });

  it('quotes a note containing a comma rather than splitting the row', async () => {
    const { service } = makeService({ claims: [{ ...claim({ amount: 100 }), note: 'paid, then left' }] });
    const csv = await service.exportCsv('c1');

    expect(csv).toContain('"paid, then left"');
    expect(csv.split('\n')).toHaveLength(2);
  });

  it('leaves the amount cell empty when none was stated', async () => {
    const { service } = makeService({ claims: [claim({ amount: null })] });
    const [, row] = (await service.exportCsv('c1')).split('\n');

    expect(row.split(',')[2]).toBe('');
  });
});

describe('PaymentsService.cancelOwnClaim', () => {
  it("lets the customer undo a claim they just made", async () => {
    const { service, updated } = makeService({ claims: [claim({})] });
    const result = await service.cancelOwnClaim('shree', 'claim-1');

    expect(result.ok).toBe(true);
    expect(updated[0]).toMatchObject({ data: { status: 'cancelled' } });
  });
});

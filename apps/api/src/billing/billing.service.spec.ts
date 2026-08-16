import * as crypto from 'crypto';

import { ConfigService } from '@nestjs/config';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';

import { BillingService } from './billing.service';

import type Razorpay from 'razorpay';

const WEBHOOK_SECRET = 'test-webhook-secret';

function sign(body: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function createPrismaMock() {
  return {
    subscription: {
      findFirst: jest.fn(),
      update: jest.fn<Promise<unknown>, [{ where: { id: string }; data: Record<string, unknown> }]>(),
    },
    invoice: { findFirst: jest.fn(), create: jest.fn() },
    client: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
  };
}

function makeService(options: { configured: boolean; prisma?: ReturnType<typeof createPrismaMock> }) {
  const prisma = options.prisma ?? createPrismaMock();
  const configService = {
    get: (key: string) => (options.configured && key === 'RAZORPAY_WEBHOOK_SECRET' ? WEBHOOK_SECRET : undefined),
    getOrThrow: (key: string) => key,
  } as unknown as ConfigService;
  const razorpay = (options.configured ? {} : null) as Razorpay | null;
  const emailService = { sendInvoiceReceipt: jest.fn().mockResolvedValue(undefined) } as unknown as EmailService;
  const webhooksService = { dispatch: jest.fn().mockResolvedValue(undefined) } as unknown as WebhooksService;

  const service = new BillingService(prisma as unknown as PrismaService, configService, emailService, razorpay, webhooksService);
  return { service, prisma };
}

describe('BillingService.handleWebhook', () => {
  it('rejects with 400 when billing is not configured on this deployment', async () => {
    const { service } = makeService({ configured: false });
    const body = Buffer.from(JSON.stringify({ event: 'subscription.activated', payload: {} }));

    await expect(service.handleWebhook(body, 'any-signature')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects with 401 when the signature header is missing', async () => {
    const { service } = makeService({ configured: true });
    const body = Buffer.from(JSON.stringify({ event: 'subscription.activated', payload: {} }));

    await expect(service.handleWebhook(body, undefined)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects with 401 for a forged/malicious signature', async () => {
    const { service } = makeService({ configured: true });
    const body = Buffer.from(JSON.stringify({ event: 'subscription.activated', payload: {} }));

    await expect(service.handleWebhook(body, 'not-the-real-hmac')).rejects.toMatchObject({ status: 401 });
  });

  it('rejects with 401 when the signature was computed for a different body (tampered payload)', async () => {
    const { service } = makeService({ configured: true });
    const originalBody = JSON.stringify({ event: 'subscription.activated', payload: {} });
    const signatureForOriginal = sign(originalBody);
    const tamperedBody = Buffer.from(JSON.stringify({ event: 'subscription.activated', payload: { injected: true } }));

    await expect(service.handleWebhook(tamperedBody, signatureForOriginal)).rejects.toMatchObject({ status: 401 });
  });

  it('activates the subscription and client on a valid subscription.activated event', async () => {
    const { service, prisma } = makeService({ configured: true });
    prisma.subscription.findFirst.mockResolvedValueOnce({ id: 'sub-1', clientId: 'client-1' });

    const payload = {
      event: 'subscription.activated',
      payload: { subscription: { entity: { id: 'razorpay-sub-1', current_end: 1_800_000_000, status: 'active' } } },
    };
    const body = JSON.stringify(payload);

    await service.handleWebhook(Buffer.from(body), sign(body));

    expect(prisma.subscription.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'sub-1' },
      data: { status: 'active' },
    });
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'client-1' }, data: { status: 'active' } }),
    );
  });

  it('creates exactly one invoice on subscription.charged, even if the same event is delivered twice (idempotent retry)', async () => {
    const { service, prisma } = makeService({ configured: true });
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', clientId: 'client-1' });

    const payload = {
      event: 'subscription.charged',
      payload: {
        subscription: { entity: { id: 'razorpay-sub-1', current_end: 1_800_000_000, status: 'active' } },
        payment: { entity: { id: 'pay-1', amount: 50000, status: 'captured' } },
      },
    };
    const body = JSON.stringify(payload);
    const signature = sign(body);

    prisma.invoice.findFirst.mockResolvedValueOnce(null);
    await service.handleWebhook(Buffer.from(body), signature);
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);

    prisma.invoice.findFirst.mockResolvedValueOnce({ id: 'existing-invoice' });
    await service.handleWebhook(Buffer.from(body), signature);
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
  });

  it('cancels the subscription on subscription.cancelled', async () => {
    const { service, prisma } = makeService({ configured: true });
    prisma.subscription.findFirst.mockResolvedValueOnce({ id: 'sub-1', clientId: 'client-1' });

    const payload = { event: 'subscription.cancelled', payload: { subscription: { entity: { id: 'razorpay-sub-1', status: 'cancelled' } } } };
    const body = JSON.stringify(payload);

    await service.handleWebhook(Buffer.from(body), sign(body));

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-1' }, data: { status: 'cancelled' } }),
    );
  });

  it('does not throw for an unrecognized event type', async () => {
    const { service } = makeService({ configured: true });
    const body = JSON.stringify({ event: 'some.unknown.event', payload: {} });

    await expect(service.handleWebhook(Buffer.from(body), sign(body))).resolves.toBeUndefined();
  });

  it('does not throw when a referenced subscription cannot be found locally (unknown gateway id)', async () => {
    const { service, prisma } = makeService({ configured: true });
    prisma.subscription.findFirst.mockResolvedValueOnce(null);

    const payload = { event: 'subscription.activated', payload: { subscription: { entity: { id: 'unknown-sub', status: 'active' } } } };
    const body = JSON.stringify(payload);

    await expect(service.handleWebhook(Buffer.from(body), sign(body))).resolves.toBeUndefined();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});

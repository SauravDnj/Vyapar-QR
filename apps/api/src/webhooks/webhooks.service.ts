import { randomBytes, createHmac } from 'node:crypto';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { leadPayload, paymentPayload } from './payloads';

import type { OutboundWebhook } from '../jsondb';
import type { WebhookEventType } from './dto/create-webhook.dto';

const SECRET_BYTES = 24;

/** What a Google Sheets connection subscribes to: everything that has a tab. */
export const SHEETS_EVENT_TYPES: WebhookEventType[] = [
  'lead.created',
  'lead.updated',
  'payment.claimed',
  'payment.updated',
  'feedback.received',
];

/**
 * A delivery gives up after this long.
 *
 * Every dispatch is awaited inside the request that caused it — a customer's
 * contact form, a payment — because on Vercel a promise left running after the
 * response is simply frozen and never delivered. So a slow endpoint is a slow
 * customer. Google Apps Script cold-starts in several seconds, and without a
 * limit a hung one would hold the customer's submit button for as long as the
 * platform allowed the function to run.
 */
const DELIVERY_TIMEOUT_MS = 10_000;

/** How many records go in one backfill request. An Apps Script run is capped
 * at six minutes; this keeps each one to a few seconds of sheet writes. */
const BACKFILL_CHUNK = 200;

/** Events a receiver can be sent that nobody subscribes to — they are sent to
 * one webhook on purpose, by id. */
type DirectEvent = 'test' | 'lead.backfill' | 'payment.backfill';

export interface DeliveryResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

/** P4-04: client-configured outbound webhooks. `dispatch()` is called by
 * other services (Leads, Payments, Reviews, WhatsApp, Billing) on the events
 * in `WEBHOOK_EVENT_TYPES` — it is best-effort and never throws, so a client's
 * broken or slow endpoint can't break the action that triggered it. */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  list(clientId: string): Promise<OutboundWebhook[]> {
    return this.prisma.outboundWebhook.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
  }

  create(clientId: string, url: string, eventTypes: WebhookEventType[]): Promise<OutboundWebhook> {
    const secret = randomBytes(SECRET_BYTES).toString('hex');
    return this.prisma.outboundWebhook.create({
      data: { clientId, url, secret, eventTypes: eventTypes },
    });
  }

  /**
   * Starts a Google Sheets connection before its URL exists.
   *
   * The script has to contain the secret before it is deployed, and the URL
   * only exists after it is deployed — so a webhook created from a URL, the
   * only way there was, forced the owner to deploy once to get the URL and
   * again with the secret pasted in. This hands out the secret first: the row
   * is created inactive with no URL, which `dispatch` never delivers to, and
   * `connect` fills the URL in and switches it on.
   */
  prepareSheets(clientId: string): Promise<OutboundWebhook> {
    const secret = randomBytes(SECRET_BYTES).toString('hex');
    return this.prisma.outboundWebhook.create({
      data: { clientId, url: '', secret, eventTypes: SHEETS_EVENT_TYPES, isActive: false },
    });
  }

  async connect(clientId: string, id: string, url: string): Promise<OutboundWebhook> {
    await this.findOwned(clientId, id);
    return this.prisma.outboundWebhook.update({
      where: { id },
      data: { url, isActive: true, lastDeliveredAt: null, lastStatus: null, lastError: null },
    });
  }

  async remove(clientId: string, id: string): Promise<void> {
    await this.findOwned(clientId, id);
    await this.prisma.outboundWebhook.delete({ where: { id } });
  }

  async dispatch(clientId: string, eventType: WebhookEventType, payload: Record<string, unknown>): Promise<void> {
    try {
      const webhooks = await this.prisma.outboundWebhook.findMany({ where: { clientId, isActive: true } });
      const targets = webhooks.filter((webhook) => (webhook.eventTypes as unknown as string[]).includes(eventType));
      await Promise.all(targets.map((webhook) => this.deliver(webhook, eventType, payload)));
    } catch (error) {
      // Even the lookup failing must not fail the lead or payment behind it.
      this.logger.warn(`Webhook dispatch for ${eventType} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** "Send test" in the admin: proves the URL, the deployment settings and the
   * secret all line up before any real customer data is sent. */
  async sendTest(clientId: string, id: string): Promise<DeliveryResult> {
    const webhook = await this.findOwned(clientId, id);
    if (!webhook.url) {
      return { ok: false, status: null, error: 'Paste your web app URL first.' };
    }
    return this.deliver(webhook, 'test', { sentAt: new Date().toISOString() });
  }

  /**
   * Sends every existing lead and payment to one webhook.
   *
   * Without this, connecting a sheet gives you an empty sheet that only fills
   * as new customers arrive — the months of leads already in the CRM never
   * appear. Receivers upsert by id, so running it twice is harmless.
   */
  async backfill(clientId: string, id: string): Promise<{ leads: number; payments: number; failed: number }> {
    const webhook = await this.findOwned(clientId, id);
    if (!webhook.url) {
      return { leads: 0, payments: 0, failed: 0 };
    }
    const [leads, payments] = await Promise.all([
      this.prisma.lead.findMany({ where: { clientId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.paymentClaim.findMany({ where: { clientId }, orderBy: { createdAt: 'asc' } }),
    ]);

    let failed = 0;
    const send = async (event: DirectEvent, items: Record<string, unknown>[]) => {
      for (let start = 0; start < items.length; start += BACKFILL_CHUNK) {
        const result = await this.deliver(webhook, event, { items: items.slice(start, start + BACKFILL_CHUNK) });
        if (!result.ok) failed += 1;
      }
    };
    await send('lead.backfill', leads.map(leadPayload));
    await send('payment.backfill', payments.map(paymentPayload));

    return { leads: leads.length, payments: payments.length, failed };
  }

  private async findOwned(clientId: string, id: string): Promise<OutboundWebhook> {
    const webhook = await this.prisma.outboundWebhook.findFirst({ where: { id, clientId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return webhook;
  }

  private async deliver(
    webhook: OutboundWebhook,
    eventType: WebhookEventType | DirectEvent,
    payload: Record<string, unknown>,
  ): Promise<DeliveryResult> {
    const body = JSON.stringify({ event: eventType, data: payload });
    const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');

    /* The signature also goes in the query string. Google Apps Script — the
       way most clients will connect a spreadsheet — hands `doPost` the body
       and the query parameters but not a single request header, so a
       signature sent only as X-VyaparQR-Signature could never be checked
       there. Leaking a per-body signature in a URL reveals nothing that
       would let anyone sign a different body. */
    let result: DeliveryResult;
    try {
      // Inside the try: a malformed stored URL is a failed delivery to record,
      // not an exception to throw out of an otherwise best-effort call.
      const target = new URL(webhook.url);
      target.searchParams.set('vqr_event', eventType);
      target.searchParams.set('vqr_signature', signature);

      const response = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-VyaparQR-Signature': signature, 'X-VyaparQR-Event': eventType },
        body,
        // Apps Script answers every POST with a 302 to the script's output;
        // following it is how the receiver's own `{ok:false}` becomes visible.
        redirect: 'follow',
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      result = { ok: response.ok, status: response.status, error: null };

      /* A receiver can reject a delivery and still answer 200 — Apps Script
         cannot set an HTTP status at all. So a JSON `{ok:false, error}` in the
         body is read as the failure it is, which is what turns a wrong secret
         from "delivered" into "bad signature" on the admin page. */
      if (response.ok && (response.headers.get('content-type') ?? '').includes('json')) {
        const parsed = (await response.json().catch(() => null)) as { ok?: unknown; error?: unknown } | null;
        if (parsed?.ok === false) {
          result = { ok: false, status: response.status, error: typeof parsed.error === 'string' ? parsed.error : 'Rejected by receiver' };
        }
      } else if (!response.ok) {
        result.error = `HTTP ${String(response.status)}`;
      }
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      result = {
        ok: false,
        status: null,
        error: timedOut ? `No answer within ${String(DELIVERY_TIMEOUT_MS / 1000)}s` : error instanceof Error ? error.message : String(error),
      };
    }

    if (!result.ok) {
      this.logger.warn(`Webhook ${eventType} to ${webhook.url} failed: ${result.error ?? 'unknown'}`);
    }
    await this.recordOutcome(webhook.id, result);
    return result;
  }

  private async recordOutcome(id: string, result: DeliveryResult): Promise<void> {
    try {
      await this.prisma.outboundWebhook.update({
        where: { id },
        data: { lastDeliveredAt: new Date(), lastStatus: result.status, lastError: result.ok ? null : result.error },
      });
    } catch {
      // Bookkeeping; the delivery itself already happened or already failed.
    }
  }
}

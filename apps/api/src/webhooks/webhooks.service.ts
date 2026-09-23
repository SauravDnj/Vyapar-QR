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
 * How long one attempt waits for the receiver.
 *
 * A measured Apps Script round trip is 4-5 seconds when warm and 11-22 when
 * Google is having a bad minute, so the old 10s limit turned an ordinary slow
 * answer into "No answer within 10s" and lost the record. The customer no
 * longer waits for any of this (see `inBackground`), so the limit can be
 * generous — but three attempts plus their backoff must still fit inside the
 * 60s a function is allowed to run (`vercel.json`).
 */
const DELIVERY_TIMEOUT_MS = 18_000;

/** Attempts per delivery. Google answers a healthy script with an occasional
 * 404 HTML page; a second try a moment later succeeds. */
const DELIVERY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [700, 2_500];

/** How many records go in one backfill request. An Apps Script run is capped
 * at six minutes; this keeps each one to a few seconds of sheet writes. */
const BACKFILL_CHUNK = 200;

/** Events a receiver can be sent that nobody subscribes to — they are sent to
 * one webhook on purpose, by id. */
type DirectEvent = 'test' | 'lead.backfill' | 'payment.backfill';

/** Made by "Connect Google Sheets": Google's own script URL, or a copy of
 * the connector subscribed to exactly the events that flow has. */
function isSheetsConnection(webhook: OutboundWebhook): boolean {
  if (webhook.url.includes('script.google.com')) return true;
  const events = webhook.eventTypes as unknown as string[];
  return SHEETS_EVENT_TYPES.every((event) => events.includes(event));
}

/** A review as the connected sheet hands it back. */
export interface ConnectorReview {
  name: string;
  rating: number;
  comment: string;
  date: string | null;
}

/**
 * Worth trying again: nothing answered, the receiver is broken or busy, or
 * Google served one of its occasional error pages for a script that is in
 * fact fine. A refusal the receiver *meant* — a bad signature answered with
 * `{ok:false}`, a 403 — will say the same thing every time, so it stands.
 */
function isWorthRetrying(result: DeliveryResult): boolean {
  if (result.status === null) return true;
  if (result.status >= 500 || result.status === 429) return true;
  return result.status === 404;
}

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
      if (targets.length === 0) return;
      await this.inBackground(Promise.all(targets.map((webhook) => this.deliver(webhook, eventType, payload))));
    } catch (error) {
      // Even the lookup failing must not fail the lead or payment behind it.
      this.logger.warn(`Webhook dispatch for ${eventType} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Keeps the customer out of the waiting.
   *
   * A serverless function freezes the moment it answers, so work left running
   * after the response is simply never finished — which is why every delivery
   * used to be awaited inside the customer's own request, making a slow sheet
   * a slow submit button. `waitUntil`, where the platform provides it, holds
   * the function open for exactly this: the customer gets their answer now and
   * the sheet is written straight after. Anywhere else the promise is awaited
   * as before, which is correct, just slower.
   */
  private async inBackground(work: Promise<unknown>): Promise<void> {
    const context = (globalThis as Record<symbol, unknown>)[Symbol.for('@vercel/request-context')] as
      | { get?: () => { waitUntil?: (promise: Promise<unknown>) => void } | undefined }
      | undefined;
    const waitUntil = context?.get?.()?.waitUntil;
    if (typeof waitUntil === 'function') {
      waitUntil(work.catch(() => undefined));
      return;
    }
    await work.catch(() => undefined);
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

  /**
   * Reads the Reviews tab back out of the client's connected sheet.
   *
   * The same script, the same secret, the same URL they already pasted — so
   * showing Google reviews on a page needs no Google API keys and no second
   * setup step. A GET has no body to sign, so the signature covers
   * `reviews:<timestamp>` and the script refuses anything older than ten
   * minutes.
   */
  async fetchReviews(clientId: string): Promise<ConnectorReview[] | null> {
    const webhooks = await this.prisma.outboundWebhook.findMany({ where: { clientId, isActive: true } });
    // Only a Sheets connection is asked for reviews. A client's own webhook
    // endpoint is not a connector and must not be probed, nor turned into a
    // "review sync failed" error.
    const candidates = webhooks.filter(isSheetsConnection);
    if (candidates.length === 0) return null;

    let lastError = 'No answer';
    for (const connector of candidates) {
      try {
        return await this.readReviewsFrom(connector);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    throw new Error(lastError);
  }

  private async readReviewsFrom(connector: OutboundWebhook): Promise<ConnectorReview[]> {
    const stamp = String(Date.now());
    const signature = createHmac('sha256', connector.secret).update(`reviews:${stamp}`).digest('hex');
    const target = new URL(connector.url);
    target.searchParams.set('vqr_action', 'reviews');
    target.searchParams.set('vqr_ts', stamp);
    target.searchParams.set('vqr_signature', signature);

    let lastError = 'No answer';
    for (let attempt = 0; attempt < DELIVERY_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS) });
        if (!response.ok) {
          lastError = `HTTP ${String(response.status)}`;
          if (!isWorthRetrying({ ok: false, status: response.status, error: lastError })) break;
        } else {
          const parsed = (await response.json().catch(() => null)) as
            | { ok?: unknown; error?: unknown; reviews?: unknown }
            | null;
          if (parsed?.ok === true && Array.isArray(parsed.reviews)) {
            return parsed.reviews
              .map((row) => row as Record<string, unknown>)
              .filter((row) => typeof row.name === 'string' && Number.isFinite(Number(row.rating)))
              .map((row) => ({
                name: String(row.name),
                rating: Number(row.rating),
                comment: typeof row.comment === 'string' ? row.comment : '',
                date: typeof row.date === 'string' ? row.date : null,
              }));
          }
          lastError = typeof parsed?.error === 'string' ? parsed.error : 'The sheet did not return any reviews.';
          break;
        }
      } catch (error) {
        const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        lastError = timedOut ? `No answer within ${String(DELIVERY_TIMEOUT_MS / 1000)}s` : String(error);
      }
      const wait = RETRY_BACKOFF_MS.at(attempt);
      if (wait === undefined) break;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    throw new Error(lastError);
  }

  private async findOwned(clientId: string, id: string): Promise<OutboundWebhook> {
    const webhook = await this.prisma.outboundWebhook.findFirst({ where: { id, clientId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return webhook;
  }

  /** Tries a delivery, retrying the failures that are worth retrying, and
   * records only the outcome that stands. */
  private async deliver(
    webhook: OutboundWebhook,
    eventType: WebhookEventType | DirectEvent,
    payload: Record<string, unknown>,
  ): Promise<DeliveryResult> {
    let result: DeliveryResult = { ok: false, status: null, error: 'Not attempted' };
    for (let attempt = 0; attempt < DELIVERY_ATTEMPTS; attempt += 1) {
      result = await this.attemptDelivery(webhook, eventType, payload);
      if (result.ok || !isWorthRetrying(result)) break;
      const wait = RETRY_BACKOFF_MS.at(attempt);
      if (wait === undefined) break;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    if (!result.ok) {
      this.logger.warn(`Webhook ${eventType} to ${webhook.url} failed: ${result.error ?? 'unknown'}`);
    }
    await this.recordOutcome(webhook.id, result);
    return result;
  }

  private async attemptDelivery(
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

import { randomBytes, createHmac } from 'node:crypto';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { WebhookEventType } from './dto/create-webhook.dto';
import type { OutboundWebhook } from '@prisma/client';

const SECRET_BYTES = 24;

/** P4-04: client-configured outbound webhooks. `dispatch()` is called by
 * other services (Leads, Reviews, Billing) on the events below — it's
 * best-effort and never throws, so a client's broken/slow endpoint can't
 * break the action that triggered it (same "log and move on" philosophy
 * as `ReviewsService.syncAllConfiguredClients`). */
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

  async remove(clientId: string, id: string): Promise<void> {
    const webhook = await this.prisma.outboundWebhook.findFirst({ where: { id, clientId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    await this.prisma.outboundWebhook.delete({ where: { id } });
  }

  async dispatch(clientId: string, eventType: WebhookEventType, payload: Record<string, unknown>): Promise<void> {
    const webhooks = await this.prisma.outboundWebhook.findMany({ where: { clientId, isActive: true } });
    const targets = webhooks.filter((webhook) => (webhook.eventTypes as unknown as string[]).includes(eventType));

    await Promise.all(targets.map((webhook) => this.deliver(webhook, eventType, payload)));
  }

  private async deliver(webhook: OutboundWebhook, eventType: WebhookEventType, payload: Record<string, unknown>): Promise<void> {
    const body = JSON.stringify({ event: eventType, data: payload });
    const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-QRHub-Signature': signature, 'X-QRHub-Event': eventType },
        body,
      });
      if (!response.ok) {
        this.logger.warn(`Webhook delivery to ${webhook.url} returned ${String(response.status)}`);
      }
    } catch (error) {
      this.logger.warn(`Webhook delivery to ${webhook.url} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { WhatsappAiService } from './whatsapp-ai.service';
import { WHATSAPP_CONFIG, type WhatsappConfig } from './whatsapp-config.provider';

import type { LeadStatus, WhatsappMessage, WhatsappSendMode, WhatsappSettings } from '@prisma/client';

const GRAPH_API_VERSION = 'v20.0';
const CONVERSATION_SCAN_LIMIT = 500;

export interface WhatsappSettingsResult {
  isEnabled: boolean;
  aiChatbotEnabled: boolean;
  systemPromptOverride: string | null;
  sendMode: WhatsappSendMode;
}

const DEFAULT_SETTINGS: WhatsappSettingsResult = {
  isEnabled: false,
  aiChatbotEnabled: false,
  systemPromptOverride: null,
  sendMode: 'auto',
};

export interface ResolvedSend {
  /** True only when the Meta Cloud API actually sent it — a real,
   * automatic delivery with no human action needed. */
  sent: boolean;
  /** A `wa.me` link to hand to whoever should send this themselves
   * (customer or owner) — populated whenever `sent` is false, or when
   * `sendMode` is `'url'` even if the Cloud API is configured. Opening it
   * launches WhatsApp with the message pre-filled; the human still taps
   * Send. */
  url: string | null;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsappConfig | null,
    private readonly prisma: PrismaService,
    private readonly whatsappAiService: WhatsappAiService,
  ) {}

  get isConfigured(): boolean {
    return this.config !== null;
  }

  /** Sends a plain-text WhatsApp message via Meta's Cloud API. Never
   * throws — a failed alert shouldn't break whatever triggered it (e.g. a
   * customer submitting feedback), same "log and move on" philosophy as
   * `ReviewsService.syncAllConfiguredClients`. `to` accepts any reasonable
   * formatting (spaces, dashes, a leading `+`) and is normalized to
   * digits-only, which is what the Cloud API expects. */
  async sendText(to: string, message: string): Promise<boolean> {
    if (!this.config) {
      this.logger.warn(`WhatsApp not configured — message not sent. To: ${to}`);
      return false;
    }

    const normalizedTo = to.replace(/[^\d]/g, '');
    if (!normalizedTo) {
      this.logger.warn(`WhatsApp send skipped — no usable phone number ("${to}").`);
      return false;
    }

    try {
      const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${this.config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizedTo, type: 'text', text: { body: message } }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.error(`WhatsApp send failed (${String(response.status)}): ${body}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('WhatsApp send failed', error instanceof Error ? error.stack : undefined);
      return false;
    }
  }

  private recordMessage(
    clientId: string | null,
    phone: string,
    direction: 'inbound' | 'outbound',
    body: string,
    isAiGenerated = false,
  ): Promise<WhatsappMessage> {
    return this.prisma.whatsappMessage.create({
      data: { clientId, phone: phone.replace(/[^\d]/g, ''), direction, body, isAiGenerated },
    });
  }

  /** P12-01: the CRM/dashboard entry point for a client sending an
   * outbound WhatsApp message — sends via the shared number, then logs the
   * message against `clientId` so a later inbound reply from this phone
   * routes back here (see `handleInbound`). */
  async sendAndRecord(clientId: string, phone: string, body: string, isAiGenerated = false): Promise<boolean> {
    const sent = await this.sendText(phone, body);
    if (sent) {
      await this.recordMessage(clientId, phone, 'outbound', body, isAiGenerated);
    }
    return sent;
  }

  async requestReview(clientId: string, leadId: string): Promise<boolean> {
    const [lead, client] = await Promise.all([
      this.prisma.lead.findFirst({ where: { id: leadId, clientId } }),
      this.prisma.client.findUnique({ where: { id: clientId }, include: { googleReviewConfig: true } }),
    ]);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (!client?.googleReviewConfig?.reviewLink) {
      throw new BadRequestException('Set up your Google review link first (Reviews settings).');
    }

    const message = `Hi! This is ${client.businessName}. Thanks for stopping by — would you mind leaving us a quick review? ${client.googleReviewConfig.reviewLink}`;
    return this.sendAndRecord(clientId, lead.phone, message);
  }

  async getSettings(clientId: string): Promise<WhatsappSettingsResult> {
    const settings = await this.prisma.whatsappSettings.findUnique({ where: { clientId } });
    return settings
      ? {
          isEnabled: settings.isEnabled,
          aiChatbotEnabled: settings.aiChatbotEnabled,
          systemPromptOverride: settings.systemPromptOverride,
          sendMode: settings.sendMode,
        }
      : DEFAULT_SETTINGS;
  }

  /** `https://wa.me/<digits>?text=<encoded message>` — opens WhatsApp
   * (app or web) with the message pre-filled, on whichever device opens
   * it. No credentials, no API — the human who opens it still has to tap
   * Send themselves, so this can never be used to power an automated
   * chatbot (there's no way for us to read what they send back). */
  private buildWaMeLink(phone: string, message: string): string {
    const digits = phone.replace(/[^\d]/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  /** The single place every "notify someone over WhatsApp" call in this
   * codebase should go through, so the auto/api/url toggle (per-client,
   * `WhatsappSettings.sendMode`) behaves identically everywhere. `auto`
   * (default) sends via the Cloud API when configured, falling back to a
   * `wa.me` link when it isn't or when the send fails; `api` only ever
   * tries the Cloud API (still returns a fallback link on failure, since
   * a working link beats nothing); `url` always returns a link, skipping
   * the API entirely even if it's configured. `clientId: null` (no
   * per-client settings row possible, e.g. before onboarding writes one)
   * behaves like `auto`. */
  async resolveSend(clientId: string | null, to: string, message: string): Promise<ResolvedSend> {
    const mode = clientId ? (await this.getSettings(clientId)).sendMode : 'auto';
    const url = this.buildWaMeLink(to, message);

    if (mode === 'url') {
      return { sent: false, url };
    }

    if (!this.isConfigured) {
      return { sent: false, url };
    }

    const sent = await this.sendText(to, message);
    return sent ? { sent: true, url: null } : { sent: false, url };
  }

  upsertSettings(clientId: string, dto: WhatsappSettingsResult): Promise<WhatsappSettings> {
    return this.prisma.whatsappSettings.upsert({
      where: { clientId },
      create: { clientId, ...dto },
      update: dto,
    });
  }

  /** Latest message per distinct phone number this client has exchanged
   * messages with, newest conversation first. Scans the most recent
   * `CONVERSATION_SCAN_LIMIT` messages rather than every message ever —
   * plenty for a lite-CRM conversation list without a raw grouped query. */
  async listConversations(clientId: string): Promise<WhatsappMessage[]> {
    const messages = await this.prisma.whatsappMessage.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: CONVERSATION_SCAN_LIMIT,
    });

    const latestByPhone = new Map<string, WhatsappMessage>();
    for (const message of messages) {
      if (!latestByPhone.has(message.phone)) {
        latestByPhone.set(message.phone, message);
      }
    }
    return Array.from(latestByPhone.values());
  }

  getConversation(clientId: string, phone: string): Promise<WhatsappMessage[]> {
    return this.prisma.whatsappMessage.findMany({
      where: { clientId, phone: phone.replace(/[^\d]/g, '') },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Webhook entry point for every inbound message on the shared number.
   * Since one number serves every client, an inbound message is routed to
   * whichever client this phone most recently exchanged a message with —
   * there's no other signal available to disambiguate. A phone with no
   * prior history on this number is logged (`clientId: null`) for
   * visibility but can't be routed or auto-replied to. */
  async handleInbound(fromPhone: string, body: string): Promise<void> {
    const normalizedPhone = fromPhone.replace(/[^\d]/g, '');
    const lastMessage = await this.prisma.whatsappMessage.findFirst({
      where: { phone: normalizedPhone, clientId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    const clientId = lastMessage?.clientId ?? null;
    const inboundMessage = await this.recordMessage(clientId, normalizedPhone, 'inbound', body);

    if (!clientId) {
      this.logger.warn(`Inbound WhatsApp message from unrecognized number ${normalizedPhone} — no client to route to.`);
      return;
    }

    const settings = await this.getSettings(clientId);
    if (!settings.isEnabled || !settings.aiChatbotEnabled) {
      return;
    }

    const reply = await this.whatsappAiService.generateReply(clientId, normalizedPhone);
    if (!reply) {
      return;
    }

    if (reply.needsHuman) {
      await this.prisma.whatsappMessage.update({ where: { id: inboundMessage.id }, data: { needsHuman: true } });
    }
    await this.sendAndRecord(clientId, normalizedPhone, reply.replyToCustomer, true);
  }

  /** P13-04: bulk-send one message to every lead matching a status filter
   * (or all leads, if none given). Sends sequentially with a small delay
   * between each — a broadcast to dozens of leads shouldn't hammer the
   * Cloud API's rate limits, same reasoning as `ReviewsService`'s sync
   * delay, just shorter since this is a synchronous request the caller is
   * waiting on. */
  async broadcast(clientId: string, message: string, status?: LeadStatus): Promise<{ sent: number; total: number }> {
    const leads = await this.prisma.lead.findMany({
      where: { clientId, ...(status ? { status } : {}) },
      select: { phone: true },
    });

    let sent = 0;
    for (const [index, lead] of leads.entries()) {
      const ok = await this.sendAndRecord(clientId, lead.phone, message);
      if (ok) sent += 1;
      if (index < leads.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    return { sent, total: leads.length };
  }
}

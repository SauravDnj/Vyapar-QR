import { Injectable, Logger } from '@nestjs/common';

import { GroqService, type GroqChatMessage } from '../ai/groq.service';
import { PrismaService } from '../prisma/prisma.service';

import type { ThemeContent } from '@qrhub/types';

/** Keep the AI on a short leash — this replies as the business on its own
 * WhatsApp number, so terse and on-topic beats chatty. */
const MAX_REPLY_TOKENS = 300;
/** How many prior messages (both directions) to include for continuity,
 * without letting one long-running conversation blow out the prompt. */
const HISTORY_LIMIT = 10;
/** Sentinel the model is instructed to answer with verbatim when it judges
 * a message needs a human — checked for an exact match, never shown to the
 * customer (see `NEEDS_HUMAN_FALLBACK_MESSAGE` below). */
const NEEDS_HUMAN_SENTINEL = 'NEEDS_HUMAN';
const NEEDS_HUMAN_FALLBACK_MESSAGE = "Thanks for reaching out! I've let our team know — someone will get back to you shortly.";

export interface WhatsappAiReply {
  replyToCustomer: string;
  needsHuman: boolean;
}

interface ClientForPrompt {
  businessName: string;
  landingPage: { contentJson: unknown } | null;
  paymentMethods: { type: string }[];
  socialLinks: { platform: string; value: string }[];
  googleReviewConfig: { reviewLink: string | null } | null;
  locations: { name: string; address: string; hours: string | null }[];
  loyaltyProgram: { isActive: boolean; stampsRequired: number; rewardText: string } | null;
}

/** P12-01/P13-04: generates WhatsApp auto-replies for a client's
 * shared-number conversations, plus (P13-02) short lead follow-up nudges,
 * via the shared `GroqService`. `generateReply` also judges whether a
 * message is safe for the AI to answer at all — see `NEEDS_HUMAN_SENTINEL`. */
@Injectable()
export class WhatsappAiService {
  private readonly logger = new Logger(WhatsappAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly groqService: GroqService,
  ) {}

  get isConfigured(): boolean {
    return this.groqService.isConfigured;
  }

  async generateReply(clientId: string, phone: string): Promise<WhatsappAiReply | null> {
    const [client, history] = await Promise.all([
      this.loadClientForPrompt(clientId),
      this.prisma.whatsappMessage.findMany({
        where: { clientId, phone },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
      }),
    ]);
    if (!client) {
      return null;
    }

    const systemPrompt = [
      this.buildBusinessContext(client, client.whatsappSettings?.systemPromptOverride ?? null),
      '',
      `If this message is an angry complaint, something the business information above can't answer, or the customer explicitly asks for a person, reply with exactly the single word "${NEEDS_HUMAN_SENTINEL}" and nothing else.`,
    ].join('\n');

    const messages: GroqChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history
        .slice()
        .reverse()
        .map((message): GroqChatMessage => ({
          role: message.direction === 'inbound' ? 'user' : 'assistant',
          content: message.body,
        })),
    ];

    const reply = await this.groqService.chatComplete(messages, MAX_REPLY_TOKENS);
    if (!reply) {
      return null;
    }
    if (reply.trim() === NEEDS_HUMAN_SENTINEL) {
      return { replyToCustomer: NEEDS_HUMAN_FALLBACK_MESSAGE, needsHuman: true };
    }
    return { replyToCustomer: reply, needsHuman: false };
  }

  /** P13-02: a short, personalized nudge for a lead that's gone quiet.
   * Falls back to a plain template when Groq isn't configured (or fails)
   * rather than skipping the follow-up entirely — a generic nudge still
   * beats no nudge. */
  async draftFollowUpMessage(clientId: string, leadName: string): Promise<string> {
    const client = await this.loadClientForPrompt(clientId);
    const fallback = `Hi ${leadName}! Just checking in — is there anything we can help with? Reply here anytime. — ${client?.businessName ?? 'the team'}`;
    if (!client) {
      return fallback;
    }

    const messages: GroqChatMessage[] = [
      { role: 'system', content: this.buildBusinessContext(client, null) },
      {
        role: 'user',
        content: `Write a short, warm, one-message WhatsApp follow-up to a customer named "${leadName}" who reached out a day ago and hasn't heard back yet. Invite them to reply if they still need anything. One or two sentences, no markdown, sign off with the business name.`,
      },
    ];
    const draft = await this.groqService.chatComplete(messages, 120, 0.6);
    return draft ?? fallback;
  }

  /** P13-04: drafts one message for a WhatsApp broadcast from a short
   * owner-written prompt (e.g. "announce our Diwali sale"), grounded in the
   * business's real context so it doesn't invent details. Returns `null`
   * when Groq isn't configured — there's no sensible non-AI fallback for an
   * arbitrary marketing prompt the way there is for a follow-up nudge. */
  async draftBroadcastMessage(clientId: string, prompt: string): Promise<string | null> {
    const client = await this.loadClientForPrompt(clientId);
    if (!client) {
      return null;
    }
    const messages: GroqChatMessage[] = [
      { role: 'system', content: this.buildBusinessContext(client, null) },
      {
        role: 'user',
        content: `Write one short WhatsApp broadcast message for this business based on this request: "${prompt}". No markdown, no placeholders like [name] — this goes out as-is to a list of customers.`,
      },
    ];
    return this.groqService.chatComplete(messages, 200, 0.6);
  }

  private async loadClientForPrompt(clientId: string): Promise<(ClientForPrompt & { whatsappSettings: { systemPromptOverride: string | null } | null }) | null> {
    return this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        landingPage: true,
        paymentMethods: true,
        socialLinks: true,
        googleReviewConfig: true,
        locations: { orderBy: { displayOrder: 'asc' } },
        loyaltyProgram: true,
        whatsappSettings: true,
      },
    });
  }

  buildBusinessContext(client: ClientForPrompt, customInstructions: string | null): string {
    const content = (client.landingPage?.contentJson as ThemeContent | undefined) ?? {};
    const about = content.about ?? {};
    const contact = content.contact ?? {};

    const lines = [
      `You are the WhatsApp assistant for "${client.businessName}", replying directly to a customer on the business's behalf.`,
      'Be brief, warm, and helpful — this is a WhatsApp chat, not an email. A few sentences at most, no markdown formatting.',
      "Only answer using the business information below. If you don't know something, say so rather than inventing details like prices, stock, or exact hours you weren't given.",
      '',
      '--- Business information ---',
    ];

    if (about.description) lines.push(`About: ${about.description}`);
    if (about.address) lines.push(`Address: ${about.address}`);
    if (about.hours) lines.push(`Hours: ${about.hours}`);
    if (about.phone) lines.push(`Phone: ${about.phone}`);
    if (contact.bookingUrl) lines.push(`Booking link: ${contact.bookingUrl}`);

    if (client.locations.length > 0) {
      lines.push(
        `Locations: ${client.locations.map((location) => `${location.name} (${location.address}${location.hours ? `, ${location.hours}` : ''})`).join('; ')}`,
      );
    }

    if (client.paymentMethods.length > 0) {
      lines.push(`Accepted payment methods: ${[...new Set(client.paymentMethods.map((method) => method.type))].join(', ')}.`);
    }

    if (client.googleReviewConfig?.reviewLink) {
      lines.push(`Google review link (share if a customer wants to leave a review): ${client.googleReviewConfig.reviewLink}`);
    }

    if (client.loyaltyProgram?.isActive) {
      lines.push(
        `Loyalty program: customers earn a stamp per visit; after ${String(client.loyaltyProgram.stampsRequired)} stamps they get: ${client.loyaltyProgram.rewardText}.`,
      );
    }

    const socialSummary = client.socialLinks
      .filter((link) => link.platform !== 'whatsapp')
      .map((link) => `${link.platform}: ${link.value}`);
    if (socialSummary.length > 0) {
      lines.push(`Social: ${socialSummary.join(', ')}`);
    }

    if (customInstructions) {
      lines.push('', '--- Additional instructions from the business owner ---', customInstructions);
    }

    return lines.join('\n');
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';

import { GROQ_CONFIG, type GroqConfig } from './groq-config.provider';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_MAX_TOKENS = 300;

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Shared, thin wrapper around Groq's OpenAI-compatible chat completions
 * API — every AI feature in this codebase (WhatsApp chatbot, review-reply
 * drafts, onboarding autofill, weekly digest summaries) goes through this
 * one client rather than each reimplementing the fetch call. Every method
 * returns `null` (never throws) whenever it can't produce a result —
 * missing `GROQ_API_KEY`, an API error, or an empty response — so a
 * flaky/unset AI provider always degrades to "no AI output" for whichever
 * feature called it, rather than breaking that feature's core flow. */
@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  constructor(@Inject(GROQ_CONFIG) private readonly config: GroqConfig | null) {}

  get isConfigured(): boolean {
    return this.config !== null;
  }

  async chatComplete(messages: GroqChatMessage[], maxTokens = DEFAULT_MAX_TOKENS, temperature = 0.4): Promise<string | null> {
    if (!this.config) {
      this.logger.warn('Groq not configured — skipping AI generation.');
      return null;
    }

    try {
      const response = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: maxTokens, temperature }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.error(`Groq chat completion failed (${String(response.status)}): ${body}`);
        return null;
      }

      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = data.choices?.[0]?.message?.content?.trim();
      return reply && reply.length > 0 ? reply : null;
    } catch (error) {
      this.logger.error('Groq chat completion failed', error instanceof Error ? error.stack : undefined);
      return null;
    }
  }
}

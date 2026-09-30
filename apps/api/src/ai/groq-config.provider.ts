import { ConfigService } from '@nestjs/config';

import type { Provider } from '@nestjs/common';

export const GROQ_CONFIG = 'GROQ_CONFIG';

export interface GroqConfig {
  apiKey: string;
  /** Groq retires models (llama-3.3-70b-versatile went in 2026, and every AI
   * feature silently fell back to templates), so the model is a setting:
   * swapping it is an env change, not a deploy of new code. */
  model: string;
}

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

/** Returns null when `GROQ_API_KEY` isn't set — `GroqService` handles that
 * by returning `null` from every method instead of crashing, same
 * "not configured" pattern as `whatsappConfigProvider`/`razorpayProvider`. */
export const groqConfigProvider: Provider = {
  provide: GROQ_CONFIG,
  useFactory: (configService: ConfigService): GroqConfig | null => {
    const apiKey = configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      return null;
    }
    // A blank GROQ_MODEL (as in .env.example) means "use the default".
    const model = configService.get<string>('GROQ_MODEL')?.trim() ?? '';
    return { apiKey, model: model === '' ? DEFAULT_GROQ_MODEL : model };
  },
  inject: [ConfigService],
};

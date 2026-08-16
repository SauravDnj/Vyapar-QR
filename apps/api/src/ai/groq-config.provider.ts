import { ConfigService } from '@nestjs/config';

import type { Provider } from '@nestjs/common';

export const GROQ_CONFIG = 'GROQ_CONFIG';

export interface GroqConfig {
  apiKey: string;
}

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
    return { apiKey };
  },
  inject: [ConfigService],
};

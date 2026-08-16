import { ConfigService } from '@nestjs/config';

import type { Provider } from '@nestjs/common';

export const PLACES_API_KEY = 'PLACES_API_KEY';

/** Returns null when no Places API key is configured — ReviewsService
 * falls back to the Google Sheets sync path in that case, same
 * "returns null when unconfigured" pattern as every other integration
 * provider in this codebase. */
export const placesApiKeyProvider: Provider = {
  provide: PLACES_API_KEY,
  useFactory: (configService: ConfigService): string | null => {
    return configService.get<string>('GOOGLE_PLACES_API_KEY') ?? null;
  },
  inject: [ConfigService],
};

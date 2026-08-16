import { ConfigService } from '@nestjs/config';

import type { Provider } from '@nestjs/common';

export const WHATSAPP_CONFIG = 'WHATSAPP_CONFIG';

export interface WhatsappConfig {
  accessToken: string;
  phoneNumberId: string;
}

/** Returns null when the WhatsApp Business (Meta Cloud API) credentials
 * aren't set — `WhatsappService` handles that by logging and skipping
 * rather than crashing, same "not configured" pattern as `razorpayProvider`
 * and `emailTransportProvider`. */
export const whatsappConfigProvider: Provider = {
  provide: WHATSAPP_CONFIG,
  useFactory: (configService: ConfigService): WhatsappConfig | null => {
    const accessToken = configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!accessToken || !phoneNumberId) {
      return null;
    }
    return { accessToken, phoneNumberId };
  },
  inject: [ConfigService],
};

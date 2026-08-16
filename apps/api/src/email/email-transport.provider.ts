import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import type { Provider } from '@nestjs/common';
import type { Transporter } from 'nodemailer';

export const EMAIL_TRANSPORT = 'EMAIL_TRANSPORT';

/** Returns null when SMTP isn't configured — EmailService handles that by
 * logging instead of sending, same "not configured" pattern already used
 * for Razorpay and Google Sheets. */
export const emailTransportProvider: Provider = {
  provide: EMAIL_TRANSPORT,
  useFactory: (configService: ConfigService): Transporter | null => {
    const host = configService.get<string>('SMTP_HOST');
    if (!host) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port: Number(configService.get<string>('SMTP_PORT') ?? '587'),
      auth: {
        user: configService.get<string>('SMTP_USER'),
        pass: configService.get<string>('SMTP_PASSWORD'),
      },
    });
  },
  inject: [ConfigService],
};

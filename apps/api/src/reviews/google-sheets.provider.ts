import { ConfigService } from '@nestjs/config';
import { google, type sheets_v4 } from 'googleapis';

import type { Provider } from '@nestjs/common';

export const GOOGLE_SHEETS_CLIENT = 'GOOGLE_SHEETS_CLIENT';

/** Returns null when the Google service account isn't configured — review
 * sync handles that by skipping (background job) or returning a clear "not
 * configured" error (manual trigger) rather than crashing. */
export const googleSheetsProvider: Provider = {
  provide: GOOGLE_SHEETS_CLIENT,
  useFactory: (configService: ConfigService): sheets_v4.Sheets | null => {
    const email = configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = configService.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    if (!email || !privateKey) {
      return null;
    }

    const auth = new google.auth.JWT({
      email,
      key: privateKey.replace(/\\n/g, '\n'),
      // Read/write: reading synced reviews (readonly would suffice) but
      // also appending private-feedback rows, which needs full access.
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
  },
  inject: [ConfigService],
};

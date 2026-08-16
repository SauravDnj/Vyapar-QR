import { Inject, Injectable, Logger } from '@nestjs/common';

import { GOOGLE_SHEETS_CLIENT } from './google-sheets.provider';

import type { sheets_v4 } from 'googleapis';

export interface ColumnMapping {
  reviewerName: string;
  rating: string;
  comment: string;
  reviewDate: string;
}

export const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  reviewerName: 'A',
  rating: 'B',
  comment: 'C',
  reviewDate: 'D',
};

export interface SheetReviewRow {
  reviewerName: string;
  rating: number;
  comment: string | null;
  reviewDate: Date | null;
}

function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (const char of letter.trim().toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

/** The range's leading column, e.g. "Sheet1!B2:E" -> "B". Defaults to "A". */
function rangeStartColumn(range: string): string {
  const match = /![A-Za-z]*?([A-Za-z]+)\d*/.exec(range);
  return match?.[1] ?? 'A';
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  constructor(@Inject(GOOGLE_SHEETS_CLIENT) private readonly sheets: sheets_v4.Sheets | null) {}

  get isConfigured(): boolean {
    return this.sheets !== null;
  }

  async fetchRows(sheetId: string, range: string, columnMapping: ColumnMapping): Promise<SheetReviewRow[]> {
    if (!this.sheets) {
      throw new Error('Google Sheets client is not configured');
    }

    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
    const rows = response.data.values ?? [];
    const startIndex = columnLetterToIndex(rangeStartColumn(range));

    const offsetFor = (letter: string) => columnLetterToIndex(letter) - startIndex;
    const reviewerNameIndex = offsetFor(columnMapping.reviewerName);
    const ratingIndex = offsetFor(columnMapping.rating);
    const commentIndex = offsetFor(columnMapping.comment);
    const reviewDateIndex = offsetFor(columnMapping.reviewDate);

    const parsed = rows.map((row): SheetReviewRow | null => {
      const reviewerName = typeof row[reviewerNameIndex] === 'string' ? row[reviewerNameIndex].trim() : '';
      const rating = Number(row[ratingIndex]);
      if (!reviewerName || Number.isNaN(rating)) {
        return null;
      }

      const rawDate: unknown = row[reviewDateIndex];
      const reviewDate = typeof rawDate === 'string' && rawDate ? new Date(rawDate) : null;

      return {
        reviewerName,
        rating: Math.max(1, Math.min(5, Math.round(rating))),
        comment: typeof row[commentIndex] === 'string' && row[commentIndex] ? row[commentIndex] : null,
        reviewDate: reviewDate && !Number.isNaN(reviewDate.getTime()) ? reviewDate : null,
      };
    });

    const validRows = parsed.filter((row): row is SheetReviewRow => row !== null);
    const skippedCount = parsed.length - validRows.length;
    if (skippedCount > 0) {
      this.logger.warn(`Skipped ${String(skippedCount)} malformed row(s) (missing name or non-numeric rating) syncing sheet ${sheetId}.`);
    }

    return validRows;
  }

  /** Appends one row to the given sheet/tab — used to log private 1–3★
   * feedback. Uses USER_ENTERED so a date string renders as a real Sheets
   * date rather than plain text. */
  async appendFeedbackRow(
    sheetId: string,
    tabName: string,
    row: { rating: number; feedbackText: string | null; submittedAt: Date },
  ): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets client is not configured');
    }

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tabName}!A:C`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[row.submittedAt.toISOString(), row.rating, row.feedbackText ?? '']],
      },
    });
  }
}

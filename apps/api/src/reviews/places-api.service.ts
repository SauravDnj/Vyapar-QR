import { Inject, Injectable, Logger } from '@nestjs/common';

import { PLACES_API_KEY } from './places-api.provider';

import type { SheetReviewRow } from './google-sheets.service';

interface PlacesApiReview {
  rating?: number;
  text?: { text?: string };
  authorAttribution?: { displayName?: string };
  publishTime?: string;
}

interface PlacesApiResponse {
  rating?: number;
  userRatingCount?: number;
  reviews?: PlacesApiReview[];
}

const PLACES_API_URL = 'https://places.googleapis.com/v1/places';
const FIELD_MASK = 'rating,userRatingCount,reviews';

/** Read-only live review pull via Google's Places API (New) — the
 * credential-free-blocked-until-you-provide-a-key alternative to the
 * manual Google Sheets sync. Google's Places API doesn't support posting
 * replies (that needs the separate, OAuth-based Business Profile API,
 * intentionally out of scope here — see docs/PROGRESS.md). */
@Injectable()
export class PlacesApiService {
  private readonly logger = new Logger(PlacesApiService.name);

  constructor(@Inject(PLACES_API_KEY) private readonly apiKey: string | null) {}

  get isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async fetchReviews(placeId: string): Promise<{ avgRating: number | null; rows: SheetReviewRow[] }> {
    if (!this.apiKey) {
      throw new Error('Places API is not configured');
    }

    const response = await fetch(`${PLACES_API_URL}/${placeId}?fields=${FIELD_MASK}&key=${this.apiKey}`);
    if (!response.ok) {
      throw new Error(`Places API request failed: ${String(response.status)}`);
    }

    const data = (await response.json()) as PlacesApiResponse;
    const rows: SheetReviewRow[] = [];
    for (const review of data.reviews ?? []) {
      const displayName = review.authorAttribution?.displayName;
      if (typeof review.rating !== 'number' || !displayName) {
        continue;
      }
      rows.push({
        reviewerName: displayName,
        rating: Math.max(1, Math.min(5, Math.round(review.rating))),
        comment: review.text?.text ?? null,
        reviewDate: review.publishTime ? new Date(review.publishTime) : null,
      });
    }

    if (rows.length === 0) {
      this.logger.warn(`Places API returned no usable reviews for place ${placeId}.`);
    }

    return { avgRating: data.rating ?? null, rows };
  }
}

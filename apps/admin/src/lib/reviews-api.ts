import { ApiError, apiFetch } from './api-client';

export interface ColumnMapping {
  reviewerName: string;
  rating: string;
  comment: string;
  reviewDate: string;
}

export interface ReviewConfig {
  sheetId: string | null;
  sheetRange: string | null;
  googlePlaceId: string | null;
  reviewLink: string | null;
  feedbackWhatsappNumber: string | null;
  feedbackSheetId: string | null;
  feedbackSheetTab: string | null;
  columnMapping: ColumnMapping | null;
  avgRatingCached: string | null;
  lastSyncedAt: string | null;
}

export interface ReviewConfigResult {
  config: ReviewConfig | null;
  sheetsConfigured: boolean;
  whatsappConfigured: boolean;
  aiConfigured: boolean;
  placesConfigured: boolean;
  effectiveReviewUrl: string | null;
}

export interface ReviewLinkCheck {
  valid: boolean;
  message: string;
  finalUrl: string | null;
  businessName: string | null;
  placeId: string | null;
  address: string | null;
  reviewUrl: string | null;
}

export function checkReviewLink(accessToken: string, url: string) {
  return apiFetch<ReviewLinkCheck>('/reviews/config/check-link', { method: 'POST', body: { url }, accessToken });
}

export interface FunnelResponse {
  id: string;
  ratingGiven: number;
  routedToGoogle: boolean;
  feedbackText: string | null;
  customerNotes: string | null;
  reviewText: string | null;
  aiDrafted: boolean | null;
  handedOffAt: string | null;
  createdAt: string;
}

export function getFunnelResponses(accessToken: string) {
  return apiFetch<FunnelResponse[]>('/reviews/funnel-responses', { accessToken });
}

export interface SaveReviewConfigInput {
  sheetId?: string;
  sheetRange?: string;
  googlePlaceId?: string;
  reviewLink?: string;
  feedbackWhatsappNumber?: string;
  feedbackSheetId?: string;
  feedbackSheetTab?: string;
  columnMapping?: ColumnMapping;
}

export function getReviewConfig(accessToken: string) {
  return apiFetch<ReviewConfigResult>('/reviews/config', { accessToken });
}

export function saveReviewConfig(accessToken: string, data: SaveReviewConfigInput) {
  return apiFetch<ReviewConfig>('/reviews/config', { method: 'PUT', body: data, accessToken });
}

export function syncReviewsNow(accessToken: string) {
  return apiFetch<ReviewConfig>('/reviews/sync', { method: 'POST', accessToken });
}

export interface FunnelStats {
  totalResponses: number;
  highRatingCount: number;
  lowRatingCount: number;
  highRatingPercent: number;
  lowRatingPercent: number;
}

export function getFunnelStats(accessToken: string) {
  return apiFetch<FunnelStats>('/reviews/funnel-stats', { accessToken });
}

export interface CachedReview {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  reviewDate: string;
  aiReplyDraft: string | null;
}

export function getCachedReviews(accessToken: string) {
  return apiFetch<CachedReview[]>('/reviews/cached', { accessToken });
}

export function draftReviewReply(accessToken: string, reviewId: string) {
  return apiFetch<{ draft: string | null }>(`/reviews/${reviewId}/draft-reply`, { method: 'POST', accessToken });
}

export { ApiError };

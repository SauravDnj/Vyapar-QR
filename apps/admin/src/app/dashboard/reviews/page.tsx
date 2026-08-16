'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { StatCard } from '../../../components/ui/stat-card';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  draftReviewReply,
  getCachedReviews,
  getFunnelStats,
  getReviewConfig,
  saveReviewConfig,
  syncReviewsNow,
  type CachedReview,
  type ColumnMapping,
  type FunnelStats,
  type ReviewConfig,
} from '../../../lib/reviews-api';

const DEFAULT_MAPPING: ColumnMapping = {
  reviewerName: 'A',
  rating: 'B',
  comment: 'C',
  reviewDate: 'D',
};

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="font-mono text-sm text-warning" aria-label={`${String(rating)} stars`}>
      {'★'.repeat(Math.round(rating))}
      <span className="text-muted">{'★'.repeat(Math.max(0, 5 - Math.round(rating)))}</span>
    </span>
  );
}

function ReviewRow({ accessToken, review }: { accessToken: string | null; review: CachedReview }) {
  const [draft, setDraft] = useState(review.aiReplyDraft);
  const [isDrafting, setIsDrafting] = useState(false);

  async function handleDraft() {
    if (!accessToken) return;
    setIsDrafting(true);
    try {
      const result = await draftReviewReply(accessToken, review.id);
      setDraft(result.draft);
    } finally {
      setIsDrafting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{review.reviewerName}</p>
        <StarRow rating={review.rating} />
      </div>
      {review.comment && <p className="text-sm text-muted">{review.comment}</p>}
      <p className="font-mono text-xs text-muted">{new Date(review.reviewDate).toLocaleDateString()}</p>

      {draft && (
        <div className="mt-1 rounded border border-border-color bg-background p-2 text-sm">
          <p className="mb-1 text-xs font-medium text-muted">Suggested reply</p>
          <p>{draft}</p>
        </div>
      )}
      <button
        onClick={() => void handleDraft()}
        disabled={isDrafting}
        className="w-fit text-xs text-accent underline disabled:opacity-50"
      >
        {isDrafting ? 'Drafting…' : draft ? 'Regenerate AI reply' : 'Draft AI reply'}
      </button>
    </div>
  );
}

function ReviewsContent() {
  const { accessToken } = useAuth();
  const [config, setConfig] = useState<ReviewConfig | null>(null);
  const [sheetsConfigured, setSheetsConfigured] = useState(false);
  const [whatsappConfigured, setWhatsappConfigured] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [sheetRange, setSheetRange] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [reviewLink, setReviewLink] = useState('');
  const [feedbackWhatsappNumber, setFeedbackWhatsappNumber] = useState('');
  const [feedbackSheetId, setFeedbackSheetId] = useState('');
  const [feedbackSheetTab, setFeedbackSheetTab] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [reviews, setReviews] = useState<CachedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [result, stats, cached] = await Promise.all([
        getReviewConfig(accessToken),
        getFunnelStats(accessToken),
        getCachedReviews(accessToken),
      ]);
      setConfig(result.config);
      setSheetsConfigured(result.sheetsConfigured);
      setWhatsappConfigured(result.whatsappConfigured);
      setSheetId(result.config?.sheetId ?? '');
      setSheetRange(result.config?.sheetRange ?? '');
      setGooglePlaceId(result.config?.googlePlaceId ?? '');
      setReviewLink(result.config?.reviewLink ?? '');
      setFeedbackWhatsappNumber(result.config?.feedbackWhatsappNumber ?? '');
      setFeedbackSheetId(result.config?.feedbackSheetId ?? '');
      setFeedbackSheetTab(result.config?.feedbackSheetTab ?? '');
      setMapping(result.config?.columnMapping ?? DEFAULT_MAPPING);
      setFunnelStats(stats);
      setReviews(cached);
    } catch {
      setMessage('Failed to load review settings.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleSave() {
    if (!accessToken) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await saveReviewConfig(accessToken, {
        sheetId: sheetId || undefined,
        sheetRange: sheetRange || undefined,
        googlePlaceId: googlePlaceId || undefined,
        reviewLink: reviewLink || undefined,
        feedbackWhatsappNumber: feedbackWhatsappNumber || undefined,
        feedbackSheetId: feedbackSheetId || undefined,
        feedbackSheetTab: feedbackSheetTab || undefined,
        columnMapping: mapping,
      });
      setConfig(updated);
      setMessage('Saved.');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSync() {
    if (!accessToken) return;
    setIsSyncing(true);
    setMessage(null);
    try {
      const updated = await syncReviewsNow(accessToken);
      setConfig(updated);
      setReviews(await getCachedReviews(accessToken));
      setMessage('Sync complete.');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to sync.');
    } finally {
      setIsSyncing(false);
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Google Reviews</h1>
      <p className="text-sm text-muted">Connect a Google Sheet of reviews and track the smart rating funnel.</p>
      {message && <p className="text-sm">{message}</p>}

      {!sheetsConfigured && (
        <p className="w-fit rounded-md border border-warning bg-warning-bg p-3 text-sm text-warning">
          Google Sheets sync isn&apos;t configured on this deployment yet — you can still save your settings, but
          &quot;Sync now&quot; won&apos;t be able to pull reviews until it is.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard label="Total ratings" value={funnelStats?.totalResponses ?? 0} />
            <StatCard
              label="4-5★ → Google"
              value={funnelStats ? `${String(funnelStats.highRatingCount)} (${String(funnelStats.highRatingPercent)}%)` : '—'}
            />
            <StatCard
              label="1-3★ private"
              value={funnelStats ? `${String(funnelStats.lowRatingCount)} (${String(funnelStats.lowRatingPercent)}%)` : '—'}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-medium">Smart Review Filter alerts</p>
              <Badge tone={whatsappConfigured ? 'success' : 'neutral'}>{whatsappConfigured ? 'WhatsApp live' : 'WhatsApp not set up'}</Badge>
            </div>
            <p className="text-xs text-muted">
              1–3★ feedback never goes public — it&apos;s always emailed to you, sent to WhatsApp below if this
              deployment has WhatsApp alerts enabled, and appended as a new row to the Google Sheet below if set.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              Owner WhatsApp number (with country code)
              <input
                type="text"
                value={feedbackWhatsappNumber}
                onChange={(event) => setFeedbackWhatsappNumber(event.target.value)}
                placeholder="+919876543210"
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Feedback Sheet ID (defaults to the Google Sheet below if blank)
              <input
                type="text"
                value={feedbackSheetId}
                onChange={(event) => setFeedbackSheetId(event.target.value)}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Feedback tab name
              <input
                type="text"
                value={feedbackSheetTab}
                onChange={(event) => setFeedbackSheetTab(event.target.value)}
                placeholder="Feedback"
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <button
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-medium">Google Sheet</p>
              <Badge tone={sheetsConfigured ? 'success' : 'neutral'}>{sheetsConfigured ? 'Configured' : 'Not configured'}</Badge>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Sheet ID
              <input
                type="text"
                value={sheetId}
                onChange={(event) => setSheetId(event.target.value)}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Sheet range
              <input
                type="text"
                value={sheetRange}
                onChange={(event) => setSheetRange(event.target.value)}
                placeholder="Sheet1!A2:D"
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Google Place ID
              <input
                type="text"
                value={googlePlaceId}
                onChange={(event) => setGooglePlaceId(event.target.value)}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Google review link
              <input
                type="text"
                value={reviewLink}
                onChange={(event) => setReviewLink(event.target.value)}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>

            <p className="pt-1 text-xs text-muted">Column mapping — which sheet column holds each field.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Reviewer name
                <input
                  type="text"
                  value={mapping.reviewerName}
                  onChange={(event) => setMapping({ ...mapping, reviewerName: event.target.value })}
                  className="rounded-md border border-border-color px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Rating
                <input
                  type="text"
                  value={mapping.rating}
                  onChange={(event) => setMapping({ ...mapping, rating: event.target.value })}
                  className="rounded-md border border-border-color px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Comment
                <input
                  type="text"
                  value={mapping.comment}
                  onChange={(event) => setMapping({ ...mapping, comment: event.target.value })}
                  className="rounded-md border border-border-color px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Review date
                <input
                  type="text"
                  value={mapping.reviewDate}
                  onChange={(event) => setMapping({ ...mapping, reviewDate: event.target.value })}
                  className="rounded-md border border-border-color px-3 py-2"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                disabled={isSaving}
                onClick={() => void handleSave()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                disabled={isSyncing}
                onClick={() => void handleSync()}
                className="rounded-md border border-border-color px-4 py-2 text-sm disabled:opacity-50"
              >
                {isSyncing ? 'Syncing…' : 'Sync now'}
              </button>
            </div>

            {config?.lastSyncedAt && (
              <p className="text-xs text-muted">
                Last synced {new Date(config.lastSyncedAt).toLocaleString()} — avg rating {config.avgRatingCached ?? 'n/a'}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4 lg:col-span-3" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="font-medium">Recent reviews</p>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted">No reviews synced yet.</p>
          ) : (
            <div className="flex max-h-[36rem] flex-col divide-y divide-border-color overflow-y-auto">
              {reviews.map((review) => (
                <ReviewRow key={review.id} accessToken={accessToken} review={review} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function ReviewsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin']}>
      <ReviewsContent />
    </ProtectedRoute>
  );
}

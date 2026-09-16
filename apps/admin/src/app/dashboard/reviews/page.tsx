'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { StatCard } from '../../../components/ui/stat-card';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  checkReviewLink,
  draftReviewReply,
  getCachedReviews,
  getFunnelResponses,
  getFunnelStats,
  getReviewConfig,
  saveReviewConfig,
  syncReviewsNow,
  type CachedReview,
  type ColumnMapping,
  type FunnelResponse,
  type FunnelStats,
  type ReviewConfig,
  type ReviewLinkCheck,
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
      <span className="text-border-color">{'★'.repeat(Math.max(0, 5 - Math.round(rating)))}</span>
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
      <p className="font-mono text-xs text-muted">
        {new Date(review.reviewDate).toLocaleDateString()}
      </p>

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

function responseKind(response: FunnelResponse): {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'neutral';
} {
  if (!response.routedToGoogle) return { label: 'Private feedback', tone: 'warning' };
  if (!response.handedOffAt) return { label: 'Rated, didn’t continue', tone: 'neutral' };
  return response.aiDrafted
    ? { label: 'Sent to Google · written with help', tone: 'info' }
    : { label: 'Sent to Google', tone: 'success' };
}

function FunnelResponseRow({ response }: { response: FunnelResponse }) {
  const [copied, setCopied] = useState(false);
  const kind = responseKind(response);
  const text = response.routedToGoogle ? response.reviewText : response.feedbackText;

  return (
    <div className="flex flex-col gap-1.5 py-3 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StarRow rating={response.ratingGiven} />
        <Badge tone={kind.tone}>{kind.label}</Badge>
      </div>
      {text ? (
        <p className="text-sm">{text}</p>
      ) : (
        <p className="text-sm text-muted">No text written.</p>
      )}
      {response.customerNotes && response.customerNotes !== text ? (
        <p className="text-xs text-muted">Customer&apos;s own words: {response.customerNotes}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <p className="font-mono text-xs text-muted">
          {new Date(response.createdAt).toLocaleString()}
        </p>
        {text ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
              });
            }}
            className="text-xs text-accent underline"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ReviewsContent() {
  const { accessToken } = useAuth();
  const [config, setConfig] = useState<ReviewConfig | null>(null);
  const [sheetsConfigured, setSheetsConfigured] = useState(false);
  const [whatsappConfigured, setWhatsappConfigured] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [placesConfigured, setPlacesConfigured] = useState(false);
  const [effectiveReviewUrl, setEffectiveReviewUrl] = useState<string | null>(null);
  const [linkCheck, setLinkCheck] = useState<ReviewLinkCheck | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [funnelResponses, setFunnelResponses] = useState<FunnelResponse[]>([]);
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
      const [result, stats, cached, responses] = await Promise.all([
        getReviewConfig(accessToken),
        getFunnelStats(accessToken),
        getCachedReviews(accessToken),
        getFunnelResponses(accessToken),
      ]);
      setConfig(result.config);
      setSheetsConfigured(result.sheetsConfigured);
      setWhatsappConfigured(result.whatsappConfigured);
      setAiConfigured(result.aiConfigured);
      setPlacesConfigured(result.placesConfigured);
      setEffectiveReviewUrl(result.effectiveReviewUrl);
      setFunnelResponses(responses);
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
      setGooglePlaceId(updated.googlePlaceId ?? '');
      setReviewLink(updated.reviewLink ?? '');
      setEffectiveReviewUrl(
        updated.googlePlaceId
          ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(updated.googlePlaceId)}`
          : updated.reviewLink,
      );
      setMessage('Saved.');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCheckLink() {
    if (!accessToken || !reviewLink.trim()) return;
    setIsChecking(true);
    setLinkCheck(null);
    try {
      const result = await checkReviewLink(accessToken, reviewLink.trim());
      setLinkCheck(result);
      if (result.placeId && !googlePlaceId) {
        setGooglePlaceId(result.placeId);
      }
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to check the link.');
    } finally {
      setIsChecking(false);
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
      <p className="text-sm text-muted">
        Customers tap “Leave a review” on your page, write a few words, and AI turns them into a
        proper Google review they post in one tap. Unhappy customers send you private feedback
        instead.
      </p>
      {message && <p className="text-sm">{message}</p>}

      <div
        className="flex flex-col gap-4 rounded-lg border border-border-color bg-surface p-4"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Your Google review link</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone={effectiveReviewUrl ? 'success' : 'warning'}>
              {effectiveReviewUrl ? 'Connected' : 'Not connected'}
            </Badge>
            <Badge tone={aiConfigured ? 'success' : 'neutral'}>
              {aiConfigured ? 'AI writer live' : 'Basic writer (no AI key)'}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="google-review-link">Google Business Profile link</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="google-review-link"
              type="url"
              inputMode="url"
              value={reviewLink}
              onChange={(event) => {
                setReviewLink(event.target.value);
                setLinkCheck(null);
              }}
              placeholder="https://share.google/…"
              className="min-w-0 flex-1 rounded-md border border-border-color bg-background px-3 py-2"
            />
            <button
              type="button"
              disabled={isChecking || !reviewLink.trim()}
              onClick={() => void handleCheckLink()}
              className="rounded-md border border-border-color px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {isChecking ? 'Checking…' : 'Check link'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <p className="text-xs text-muted">
          How to get it: search your business on Google or open it in Google Maps → tap{' '}
          <strong>Share</strong> → <strong>Copy link</strong>, then paste it here. Links like
          https://share.google/…, https://maps.app.goo.gl/… and https://g.page/… all work.
        </p>

        {linkCheck ? (
          <div
            className={`flex flex-col gap-1 rounded-md border p-3 text-sm ${linkCheck.valid ? 'border-success bg-success-bg' : 'border-danger bg-danger-bg'}`}
          >
            <p className={linkCheck.valid ? 'text-success' : 'text-danger'}>{linkCheck.message}</p>
            {linkCheck.businessName ? (
              <p>
                Business: <strong>{linkCheck.businessName}</strong>
                {linkCheck.address ? (
                  <span className="text-muted"> · {linkCheck.address}</span>
                ) : null}
              </p>
            ) : null}
            {linkCheck.reviewUrl ? (
              <a
                href={linkCheck.reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit text-accent underline"
              >
                Open it to confirm it&apos;s your business
              </a>
            ) : null}
            {linkCheck.valid ? (
              <p className="text-xs text-muted">Looks right? Press Save.</p>
            ) : null}
          </div>
        ) : null}

        {effectiveReviewUrl ? (
          <p className="text-xs text-muted">
            Customers are sent to{' '}
            <a
              href={effectiveReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-accent underline"
            >
              {effectiveReviewUrl}
            </a>
            {config?.googlePlaceId
              ? ' — straight to the review box.'
              : ' — your business profile, where they tap “Write a review”.'}
          </p>
        ) : null}

        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted">Advanced: Google Place ID</summary>
          <div className="mt-2 flex flex-col gap-1">
            <input
              type="text"
              value={googlePlaceId}
              onChange={(event) => setGooglePlaceId(event.target.value)}
              placeholder="ChIJ…"
              className="rounded-md border border-border-color bg-background px-3 py-2"
            />
            <p className="text-xs text-muted">
              With a Place ID, customers land directly in Google&apos;s “Write a review” box.
              {placesConfigured ? ' It is filled in automatically when you save a share link.' : ''}
            </p>
          </div>
        </details>

        {!aiConfigured ? (
          <p className="text-xs text-muted">
            Review writing already works with a basic writer. Add a free Groq API key (GROQ_API_KEY)
            to this deployment for full AI-written reviews in any language.
          </p>
        ) : null}
      </div>

      {!sheetsConfigured && (
        <p className="w-fit rounded-md border border-warning bg-warning-bg p-3 text-sm text-warning">
          Google Sheets sync isn&apos;t configured on this deployment yet — you can still save your
          settings, but &quot;Sync now&quot; won&apos;t be able to pull reviews until it is.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard label="Total ratings" value={funnelStats?.totalResponses ?? 0} />
            <StatCard
              label="4-5★ → Google"
              value={
                funnelStats
                  ? `${String(funnelStats.highRatingCount)} (${String(funnelStats.highRatingPercent)}%)`
                  : '—'
              }
            />
            <StatCard
              label="1-3★ private"
              value={
                funnelStats
                  ? `${String(funnelStats.lowRatingCount)} (${String(funnelStats.lowRatingPercent)}%)`
                  : '—'
              }
            />
          </div>

          <div
            className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">Smart Review Filter alerts</p>
              <Badge tone={whatsappConfigured ? 'success' : 'neutral'}>
                {whatsappConfigured ? 'WhatsApp live' : 'WhatsApp not set up'}
              </Badge>
            </div>
            <p className="text-xs text-muted">
              1–3★ feedback never goes public — it&apos;s always emailed to you, and sent to
              WhatsApp below if this deployment has WhatsApp alerts enabled. Every review and
              feedback from your page is also added as a row to the review log sheet (Date · Rating
              · Text · Type · Customer&apos;s own words).
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
              Review log Sheet ID (defaults to the Google Sheet below if blank)
              <input
                type="text"
                value={feedbackSheetId}
                onChange={(event) => setFeedbackSheetId(event.target.value)}
                className="rounded-md border border-border-color px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Review log tab name
              <input
                type="text"
                value={feedbackSheetTab}
                onChange={(event) => setFeedbackSheetTab(event.target.value)}
                placeholder="Reviews"
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

          <div
            className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">Google Sheet</p>
              <Badge tone={sheetsConfigured ? 'success' : 'neutral'}>
                {sheetsConfigured ? 'Configured' : 'Not configured'}
              </Badge>
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

            <p className="pt-1 text-xs text-muted">
              Column mapping — which sheet column holds each field.
            </p>
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
                Last synced {new Date(config.lastSyncedAt).toLocaleString()} — avg rating{' '}
                {config.avgRatingCached ?? 'n/a'}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-3">
          <div
            className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <p className="font-medium">Reviews written on your page</p>
            {funnelResponses.length === 0 ? (
              <p className="text-sm text-muted">No one has rated you from your page yet.</p>
            ) : (
              <div className="flex max-h-[36rem] flex-col divide-y divide-border-color overflow-y-auto">
                {funnelResponses.map((response) => (
                  <FunnelResponseRow key={response.id} response={response} />
                ))}
              </div>
            )}
            <p className="text-xs text-muted">
              “Sent to Google” means the customer copied their review and opened Google. Google
              doesn&apos;t tell us whether they pressed Post.
            </p>
          </div>

          <div
            className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <p className="font-medium">Recent Google reviews (synced)</p>
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

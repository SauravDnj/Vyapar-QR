'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

type Step = 'rate' | 'feedback' | 'draft' | 'thanks';

async function submitFunnel(slug: string, rating: number, feedbackText?: string, website?: string) {
  const response = await fetch(`${API_URL}/public/landing/${slug}/review-funnel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, feedbackText, website }),
  });
  if (!response.ok) {
    throw new Error('Request failed');
  }
  return (await response.json()) as { routedToGoogle: boolean; reviewLink: string | null };
}

async function draftReview(slug: string, rating: number, notes: string, website?: string) {
  const response = await fetch(`${API_URL}/public/landing/${slug}/review-funnel/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, notes: notes || undefined, website }),
  });
  if (!response.ok) {
    throw new Error('Request failed');
  }
  return (await response.json()) as { draft: string | null };
}

/** "Rate us" opens a bottom sheet — the visitor never leaves the page,
 * matching docs/DESIGN.md §4's requirement that this feel instant. A
 * 4-5★ rating now offers optional AI help writing the actual review text
 * before handing off to Google — no API lets any app post a review on a
 * customer's behalf, so this only ever gets them to a "copy, then paste
 * on Google's own page" step, never a silent auto-post. */
export function ReviewFunnel({ slug }: { slug?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('rate');
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [notes, setNotes] = useState('');
  const [draftText, setDraftText] = useState('');
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot — must stay hidden from real users
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!slug) {
    return null;
  }

  const clientSlug: string = slug;

  function closeAndReset() {
    setIsOpen(false);
    setStep('rate');
    setRating(null);
    setFeedbackText('');
    setNotes('');
    setDraftText('');
    setReviewLink(null);
    setCopied(false);
    setWebsite('');
    setError(null);
  }

  async function handleRate(selected: number) {
    setRating(selected);
    setError(null);

    if (selected >= 4) {
      setIsSubmitting(true);
      try {
        const result = await submitFunnel(clientSlug, selected, undefined, website);
        setReviewLink(result.reviewLink);
        setStep('draft');
      } catch {
        setError('Something went wrong. Try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setStep('feedback');
  }

  async function handleGenerateDraft() {
    if (rating === null) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await draftReview(clientSlug, rating, notes, website);
      if (result.draft) {
        setDraftText(result.draft);
      } else {
        setError("Couldn't generate a draft right now — feel free to just write your own below.");
      }
    } catch {
      setError("Couldn't generate a draft right now — feel free to just write your own below.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopyAndContinue() {
    if (draftText.trim()) {
      try {
        await navigator.clipboard.writeText(draftText.trim());
        setCopied(true);
      } catch {
        // Clipboard access denied — they can still select-and-copy manually below.
      }
    }
    if (reviewLink) {
      window.location.href = reviewLink;
    }
  }

  async function handleFeedbackSubmit() {
    if (rating === null) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await submitFunnel(clientSlug, rating, feedbackText || undefined, website);
      setStep('thanks');
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
        className="w-full max-w-xs rounded-full border px-6 py-2.5 text-sm font-medium transition hover:bg-gray-50"
      >
        Rate us
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={closeAndReset}
          />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white p-6 shadow-lg sm:rounded-2xl">
            <button
              aria-label="Close"
              onClick={closeAndReset}
              className="absolute right-4 top-4 text-lg leading-none text-gray-400"
            >
              ✕
            </button>

            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => {
                setWebsite(event.target.value);
              }}
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
              aria-hidden="true"
            />

            {step === 'thanks' ? (
              <p className="py-6 text-center text-sm text-emerald-700">Thanks for your feedback!</p>
            ) : step === 'feedback' ? (
              <div className="flex flex-col gap-3 pt-2">
                <p className="text-center text-sm">Sorry to hear that — tell us what went wrong:</p>
                <textarea
                  value={feedbackText}
                  onChange={(event) => {
                    setFeedbackText(event.target.value);
                  }}
                  rows={3}
                  placeholder="Your feedback"
                  className="rounded border px-3 py-2 text-sm"
                />
                <button
                  onClick={() => void handleFeedbackSubmit()}
                  disabled={isSubmitting}
                  className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending…' : 'Send private feedback'}
                </button>
                {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
              </div>
            ) : step === 'draft' ? (
              <div className="flex flex-col gap-3 pt-2">
                <p className="text-center text-sm font-medium">Thanks! Want help writing your Google review?</p>
                <textarea
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                  }}
                  rows={2}
                  placeholder="What did you like? (optional — leave blank and we'll keep it general)"
                  className="rounded border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleGenerateDraft()}
                  disabled={isGenerating}
                  className="rounded border px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {isGenerating ? 'Writing…' : '✨ Generate my review'}
                </button>

                <textarea
                  value={draftText}
                  onChange={(event) => {
                    setDraftText(event.target.value);
                    setCopied(false);
                  }}
                  rows={4}
                  placeholder="Your review will appear here — feel free to edit it, or just write your own"
                  className="rounded border px-3 py-2 text-sm"
                />

                <button
                  type="button"
                  onClick={() => void handleCopyAndContinue()}
                  className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  {copied ? 'Copied! Opening Google…' : 'Copy & continue to Google'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (reviewLink) {
                      window.location.href = reviewLink;
                    }
                  }}
                  className="text-center text-xs text-gray-400 underline"
                >
                  Skip — just take me to Google
                </button>
                {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
                <p className="text-center text-[11px] text-gray-400">
                  You&apos;ll paste this yourself on Google&apos;s review page — we can&apos;t post it for you.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 pt-2">
                <p className="text-sm font-medium">How was your experience?</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleRate(value)}
                      aria-label={`${String(value)} star${value === 1 ? '' : 's'}`}
                      className="text-3xl leading-none disabled:opacity-50"
                    >
                      {rating !== null && value <= rating ? '★' : '☆'}
                    </button>
                  ))}
                </div>
                {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

type Step = 'rate' | 'feedback' | 'thanks';

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

/** "Rate us" opens a bottom sheet — the visitor never leaves the page,
 * matching docs/DESIGN.md §4's requirement that this feel instant. */
export function ReviewFunnel({ slug }: { slug?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('rate');
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — must stay hidden from real users
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        if (result.reviewLink) {
          window.location.href = result.reviewLink;
          return;
        }
        setStep('thanks');
      } catch {
        setError('Something went wrong. Try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setStep('feedback');
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

'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

type Step = 'rate' | 'feedback' | 'write' | 'posted' | 'thanks';

const STAR_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'] as const;

/** Generic enough for a cafe, a salon or a tailor — the customer picks what
 * applies and the AI only writes about what they picked. */
const HIGHLIGHTS = [
  'Quality',
  'Service',
  'Staff',
  'Value for money',
  'Cleanliness',
  'Ambience',
  'Quick service',
] as const;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error('Request failed');
  }
  return (await response.json()) as T;
}

export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.08 6.33L12 17.31 6.32 20.3l1.08-6.33-4.6-4.49 6.36-.92L12 2.8z"
        fill={filled ? '#FBBC04' : 'none'}
        stroke={filled ? '#FBBC04' : '#9AA0A6'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * "Leave a review" opens a sheet on the page itself — Google's own review box
 * can't be embedded (google.com refuses to load in an iframe), so the whole
 * writing step happens here and only the final "Post" happens on Google.
 *
 * 4-5★: the customer types a few words in any language, optionally lets AI
 * turn them into a proper review, then "Post on Google" copies it and opens
 * Google's review box for them to paste and post. No API lets any app post a
 * review on a customer's behalf, so that last step is always theirs.
 * 1-3★: private feedback to the owner, never public.
 */
export function ReviewFunnel({
  slug,
  businessName,
  renderTrigger,
  autoOpen = false,
}: {
  slug?: string;
  businessName?: string;
  /** Lets a theme draw its own button; it receives the function that opens the sheet. */
  renderTrigger?: (open: () => void) => React.ReactNode;
  /** Opens the sheet on mount — for the share link, whose only purpose is this. */
  autoOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('rate');
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [notes, setNotes] = useState('');
  const [highlights, setHighlights] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [aiDrafted, setAiDrafted] = useState(false);
  const [variant, setVariant] = useState(0);
  const [copied, setCopied] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot — must stay hidden from real users
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [isBack, setIsBack] = useState(false);

  // Opened after mount, not during render: the sheet is a portal, so starting
  // it open on the server produced markup the client didn't match and React
  // threw the whole tree away and re-rendered it.
  useEffect(() => {
    if (autoOpen) {
      setIsOpen(true);
    }
  }, [autoOpen]);

  // Posting needs the visitor signed in to Google, and the browser inside
  // WhatsApp or Instagram has no Google session — the review box asks them to
  // sign in and the post is lost. Detect it so the sheet can say so up front.
  useEffect(() => {
    setInAppBrowser(/FBAN|FBAV|Instagram|Line\/|WhatsApp|GSA\//i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  if (!slug) {
    // Admin previews have no page to post back to; the button still shows so
    // the layout matches what customers will see.
    return renderTrigger ? <>{renderTrigger(() => undefined)}</> : null;
  }

  const clientSlug: string = slug;
  const shownRating = hovered ?? rating;

  function closeAndReset() {
    setIsOpen(false);
    setStep('rate');
    setRating(null);
    setHovered(null);
    setResponseId(null);
    setReviewLink(null);
    setFeedbackText('');
    setNotes('');
    setHighlights([]);
    setReviewText('');
    setAiDrafted(false);
    setVariant(0);
    setCopied(false);
    setWebsite('');
    setError(null);
  }

  async function handleRate(selected: number) {
    setRating(selected);
    setError(null);
    if (selected < 4) {
      setStep('feedback');
      return;
    }
    // Re-rating 4↔5 after the response exists just updates the stars locally.
    if (responseId) {
      setStep('write');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await postJson<{ reviewLink: string | null; responseId: string | null }>(
        `/public/landing/${clientSlug}/review-funnel`,
        { rating: selected, website },
      );
      setReviewLink(result.reviewLink);
      setResponseId(result.responseId);
      setStep('write');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Coming back to this tab means they've been to Google — swap the steps for
  // a short "did it post?" so the owner learns whether the hand-off landed.
  useEffect(() => {
    if (step !== 'posted') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') setIsBack(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [step]);

  function toggleHighlight(item: string) {
    setHighlights((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );
  }

  async function handleGenerate(nextVariant: number) {
    if (rating === null) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await postJson<{ draft: string | null }>(
        `/public/landing/${clientSlug}/review-funnel/draft`,
        {
          rating,
          notes: notes.trim() || undefined,
          highlights,
          variant: nextVariant,
          website,
        },
      );
      if (result.draft) {
        setReviewText(result.draft);
        setAiDrafted(true);
        setVariant(nextVariant);
        setCopied(false);
      } else {
        setError('Couldn’t write it right now — you can type your review below.');
      }
    } catch {
      setError('Couldn’t write it right now — you can type your review below.');
    } finally {
      setIsGenerating(false);
    }
  }

  function finalText() {
    return (reviewText.trim() || notes.trim()).trim();
  }

  async function copyText(text: string) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Runs on the tap that opens Google.
   *
   * The link itself is a real `<a target="_blank">` rather than
   * `window.open`: pop-up blockers and the in-app browsers inside WhatsApp and
   * Instagram routinely swallow a scripted open, and a plain link is what
   * those browsers offer to hand to the real browser — which is where the
   * visitor's Google session lives. This only copies the text and records the
   * hand-off; navigation is the browser's job.
   */
  function handlePostOnGoogle() {
    const text = finalText();
    // Clipboard writes are only allowed as a direct result of a tap.
    void copyText(text).then((ok) => {
      setCopied(ok);
    });

    if (responseId && rating !== null) {
      void fetch(`${API_URL}/public/landing/${clientSlug}/review-funnel/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          responseId,
          rating,
          reviewText: text || undefined,
          customerNotes:
            [highlights.join(', '), notes.trim()].filter(Boolean).join(' — ') || undefined,
          aiDrafted: aiDrafted && reviewText.trim().length > 0,
          website,
        }),
      }).catch(() => undefined);
    }
  }

  async function handleFeedbackSubmit() {
    if (rating === null) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await postJson(`/public/landing/${clientSlug}/review-funnel`, {
        rating,
        feedbackText: feedbackText.trim() || undefined,
        website,
      });
      setStep('thanks');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const stars = (size: number, interactive: boolean) => (
    <div
      className="flex justify-center gap-1"
      onMouseLeave={() => {
        setHovered(null);
      }}
    >
      {[1, 2, 3, 4, 5].map((value) =>
        interactive ? (
          <button
            key={value}
            type="button"
            disabled={isSubmitting}
            onMouseEnter={() => {
              setHovered(value);
            }}
            onClick={() => void handleRate(value)}
            aria-label={`${String(value)} star${value === 1 ? '' : 's'} — ${STAR_LABELS[value - 1] ?? ''}`}
            className="rounded-full p-1 transition-transform hover:scale-110 disabled:opacity-50"
          >
            <Star filled={shownRating !== null && value <= shownRating} size={size} />
          </button>
        ) : (
          <Star key={value} filled={rating !== null && value <= rating} size={size} />
        ),
      )}
    </div>
  );

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => {
          setIsOpen(true);
        })
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
          }}
          className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full border px-6 py-2.5 text-sm font-medium transition hover:opacity-80"
        >
          <GoogleG size={16} />
          Leave a review
        </button>
      )}

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[1000] flex items-end justify-center text-left font-sans text-[#202124] sm:items-center">
              <button
                aria-label="Close"
                className="absolute inset-0 bg-black/50"
                onClick={closeAndReset}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`Review ${businessName ?? 'this business'}`}
                className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
              >
                <div className="sticky top-0 flex items-center gap-3 border-b border-[#e8eaed] bg-white px-5 py-3">
                  <GoogleG size={22} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">
                      {businessName ?? 'Rate your experience'}
                    </p>
                    <p className="text-xs text-[#5f6368]">
                      {step === 'feedback' || step === 'thanks'
                        ? 'Private feedback to the owner'
                        : 'Review on Google'}
                    </p>
                  </div>
                  <button
                    aria-label="Close"
                    onClick={closeAndReset}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-[#5f6368] hover:bg-[#f1f3f4]"
                  >
                    ×
                  </button>
                </div>

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

                <div className="px-5 py-5">
                  {step === 'rate' ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <p className="text-base font-medium">How was your experience?</p>
                      {stars(40, true)}
                      <p className="h-5 text-sm text-[#5f6368]">
                        {shownRating ? STAR_LABELS[shownRating - 1] : 'Tap a star to rate'}
                      </p>
                      {error ? <p className="text-center text-sm text-[#d93025]">{error}</p> : null}
                    </div>
                  ) : null}

                  {step === 'write' ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        {stars(24, false)}
                        <button
                          type="button"
                          onClick={() => {
                            setStep('rate');
                          }}
                          className="text-xs font-medium text-[#1a73e8]"
                        >
                          Change
                        </button>
                      </div>

                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium">What did you like?</p>
                        <div className="flex flex-wrap gap-2">
                          {HIGHLIGHTS.map((item) => {
                            const active = highlights.includes(item);
                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => {
                                  toggleHighlight(item);
                                }}
                                aria-pressed={active}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                  active
                                    ? 'border-[#1a73e8] bg-[#e8f0fe] text-[#1967d2]'
                                    : 'border-[#dadce0] text-[#3c4043] hover:bg-[#f8f9fa]'
                                }`}
                              >
                                {active ? '✓ ' : ''}
                                {item}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium">In your own words</span>
                        <textarea
                          value={notes}
                          onChange={(event) => {
                            setNotes(event.target.value);
                          }}
                          rows={2}
                          maxLength={500}
                          placeholder="e.g. food is very tasty, staff was friendly — any language is fine"
                          className="rounded-lg border border-[#dadce0] px-3 py-2 text-sm outline-none focus:border-[#1a73e8]"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => void handleGenerate(reviewText ? variant + 1 : 0)}
                        disabled={isGenerating}
                        className="flex items-center justify-center gap-2 rounded-full border border-[#dadce0] px-4 py-2.5 text-sm font-medium text-[#1a73e8] hover:bg-[#f8f9fa] disabled:opacity-60"
                      >
                        {isGenerating ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a73e8] border-t-transparent" />
                            Writing your review…
                          </>
                        ) : reviewText ? (
                          '✨ Try another version'
                        ) : (
                          '✨ Help me write my review'
                        )}
                      </button>

                      {reviewText || aiDrafted ? (
                        <label className="flex flex-col gap-2">
                          <span className="flex items-center justify-between text-sm font-medium">
                            Your review
                            <span className="text-xs font-normal text-[#5f6368]">
                              Edit anything you like
                            </span>
                          </span>
                          <textarea
                            value={reviewText}
                            onChange={(event) => {
                              setReviewText(event.target.value);
                              setCopied(false);
                            }}
                            rows={5}
                            maxLength={2000}
                            className="rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#1a73e8] focus:bg-white"
                          />
                        </label>
                      ) : null}

                      {error ? <p className="text-center text-sm text-[#d93025]">{error}</p> : null}

                      {inAppBrowser ? (
                        <p className="rounded-lg bg-[#fef7e0] px-3 py-2 text-xs leading-snug text-[#7a5900]">
                          You&apos;re inside another app&apos;s browser. Posting needs your Google
                          account, so choose <span className="font-medium">Open in browser</span> (or
                          Chrome) when Google opens.
                        </p>
                      ) : null}

                      {reviewLink ? (
                        <a
                          href={finalText() ? reviewLink : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-disabled={!finalText()}
                          onClick={(event) => {
                            if (!finalText()) {
                              event.preventDefault();
                              return;
                            }
                            handlePostOnGoogle();
                            setStep('posted');
                          }}
                          className={`flex items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-[#1765cc] ${
                            finalText() ? '' : 'pointer-events-none opacity-50'
                          }`}
                        >
                          <GoogleG size={16} />
                          Copy &amp; post on Google
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void copyText(finalText()).then((ok) => {
                              setCopied(ok);
                            })
                          }
                          disabled={!finalText()}
                          className="rounded-full bg-[#1a73e8] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {copied ? 'Copied!' : 'Copy review'}
                        </button>
                      )}
                      {reviewLink ? (
                        <a
                          href={reviewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-center text-xs text-[#5f6368] underline"
                        >
                          Skip — I’ll write it on Google
                        </a>
                      ) : null}
                      <p className="text-center text-[11px] leading-snug text-[#80868b]">
                        Your review is posted from your own Google account — we copy the text, you
                        paste it and tap Post.
                      </p>
                    </div>
                  ) : null}

                  {step === 'posted' ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f4ea] text-2xl text-[#188038]">
                          ✓
                        </span>
                        <p className="text-base font-medium">
                          {isBack ? 'Did your review post?' : copied ? 'Review copied!' : 'Almost done!'}
                        </p>
                        <p className="text-sm text-[#5f6368]">
                          {isBack
                            ? 'If it didn’t go through, your text is still copied — try again.'
                            : 'Finish on Google — it takes 10 seconds:'}
                        </p>
                      </div>
                      <ol className="flex flex-col gap-2 text-sm">
                        {[
                          'Google opens your business page',
                          `Tap “Write a review” and pick ${String(rating ?? 5)} stars`,
                          'Long-press the text box and tap Paste',
                          'Tap Post',
                        ].map((item, index) => (
                          <li
                            key={item}
                            className="flex items-center gap-3 rounded-lg bg-[#f8f9fa] px-3 py-2"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-medium text-white">
                              {index + 1}
                            </span>
                            {item}
                          </li>
                        ))}
                      </ol>
                      {finalText() ? (
                        <>
                          {copied ? null : (
                            <p className="text-center text-xs text-[#d93025]">
                              Couldn&apos;t copy automatically — select the text below and copy it.
                            </p>
                          )}
                          <textarea
                            readOnly
                            rows={4}
                            value={finalText()}
                            onFocus={(event) => {
                              event.currentTarget.select();
                            }}
                            className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] px-3 py-2 text-sm leading-relaxed text-[#3c4043]"
                          />
                        </>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void copyText(finalText()).then((ok) => {
                              setCopied(ok);
                            })
                          }
                          className="rounded-full border border-[#dadce0] px-3 py-2.5 text-sm font-medium text-[#1a73e8]"
                        >
                          Copy again
                        </button>
                        {reviewLink ? (
                          <a
                            href={reviewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-[#1a73e8] px-3 py-2.5 text-center text-sm font-medium text-white"
                          >
                            Open Google
                          </a>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={closeAndReset}
                        className="text-center text-xs text-[#5f6368] underline"
                      >
                        Close
                      </button>
                    </div>
                  ) : null}

                  {step === 'feedback' ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        {stars(24, false)}
                        <button
                          type="button"
                          onClick={() => {
                            setStep('rate');
                          }}
                          className="text-xs font-medium text-[#1a73e8]"
                        >
                          Change
                        </button>
                      </div>
                      <p className="text-sm">
                        Sorry to hear that. Tell the owner what went wrong — this stays private.
                      </p>
                      <textarea
                        value={feedbackText}
                        onChange={(event) => {
                          setFeedbackText(event.target.value);
                        }}
                        rows={4}
                        maxLength={2000}
                        placeholder="What could be better?"
                        className="rounded-lg border border-[#dadce0] px-3 py-2 text-sm outline-none focus:border-[#1a73e8]"
                      />
                      <button
                        onClick={() => void handleFeedbackSubmit()}
                        disabled={isSubmitting}
                        className="rounded-full bg-[#1a73e8] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {isSubmitting ? 'Sending…' : 'Send private feedback'}
                      </button>
                      {error ? <p className="text-center text-sm text-[#d93025]">{error}</p> : null}
                    </div>
                  ) : null}

                  {step === 'thanks' ? (
                    <div className="flex flex-col items-center gap-2 py-6 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f4ea] text-2xl text-[#188038]">
                        ✓
                      </span>
                      <p className="text-base font-medium">Thanks for your feedback</p>
                      <p className="text-sm text-[#5f6368]">
                        The owner will see it and work on it.
                      </p>
                      <button
                        type="button"
                        onClick={closeAndReset}
                        className="mt-2 text-xs text-[#5f6368] underline"
                      >
                        Close
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

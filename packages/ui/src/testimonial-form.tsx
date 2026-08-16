'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

/** Lets a visitor submit a quote for the client to curate — starts
 * unapproved, so nothing posted here shows publicly until the client
 * chooses to approve it in their dashboard. */
export function TestimonialForm({ slug }: { slug?: string }) {
  const [authorName, setAuthorName] = useState('');
  const [quote, setQuote] = useState('');
  const [rating, setRating] = useState(5);
  const [website, setWebsite] = useState(''); // honeypot — must stay hidden from real users
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!slug) {
    return null;
  }

  const clientSlug: string = slug;

  async function handleSubmit() {
    if (!authorName.trim() || !quote.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/public/landing/${clientSlug}/testimonials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName: authorName.trim(), quote: quote.trim(), rating, website }),
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      setIsSubmitted(true);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return <p className="text-center text-sm text-emerald-700">Thanks for sharing your feedback!</p>;
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
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
      <input
        value={authorName}
        onChange={(event) => {
          setAuthorName(event.target.value);
        }}
        placeholder="Your name"
        className="rounded border px-3 py-2 text-sm"
      />
      <textarea
        value={quote}
        onChange={(event) => {
          setQuote(event.target.value);
        }}
        rows={3}
        placeholder="Share your experience"
        className="rounded border px-3 py-2 text-sm"
      />
      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setRating(value);
            }}
            aria-label={`${String(value)} star${value === 1 ? '' : 's'}`}
            className="text-2xl leading-none text-amber-500"
          >
            {value <= rating ? '★' : '☆'}
          </button>
        ))}
      </div>
      <button
        onClick={() => void handleSubmit()}
        disabled={isSubmitting || !authorName.trim() || !quote.trim()}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Sending…' : 'Submit'}
      </button>
      {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

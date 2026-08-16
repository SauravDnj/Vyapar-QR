'use client';

import { useState } from 'react';

import type { SubmitEvent } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export function ContactForm({ slug }: { slug?: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — must stay hidden from real users
  const [status, setStatus] = useState<Status>('idle');

  if (!slug) {
    return null;
  }

  const clientSlug: string = slug;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    try {
      const response = await fetch(`${API_URL}/public/landing/${clientSlug}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, message: message || undefined, website: website || undefined }),
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      setStatus('sent');
      setName('');
      setPhone('');
      setMessage('');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return <p className="text-center text-sm text-emerald-700">Thanks — we&apos;ll get back to you soon.</p>;
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="flex flex-col gap-3"
    >
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
        type="text"
        required
        placeholder="Your name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        className="rounded border px-3 py-2 text-sm"
      />
      <input
        type="tel"
        required
        placeholder="Your phone number"
        value={phone}
        onChange={(event) => {
          setPhone(event.target.value);
        }}
        className="rounded border px-3 py-2 text-sm"
      />
      <textarea
        placeholder="Message (optional)"
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
        }}
        rows={3}
        className="rounded border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === 'submitting' ? 'Sending…' : 'Send'}
      </button>
      {status === 'error' ? <p className="text-center text-sm text-red-600">Something went wrong. Try again.</p> : null}
    </form>
  );
}

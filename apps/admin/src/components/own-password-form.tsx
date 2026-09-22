'use client';

import { useState } from 'react';

import { ApiError, changePassword } from '../lib/account-api';

import { MIN_PASSWORD_LENGTH } from './password-field';

/** Changing the signed-in person's own password: needs the current one. */
export function OwnPasswordForm({ accessToken, email }: { accessToken: string; email: string | undefined }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (next.length < MIN_PASSWORD_LENGTH) {
      setNotice({ tone: 'error', text: `The new password needs at least ${String(MIN_PASSWORD_LENGTH)} characters.` });
      return;
    }
    if (next !== confirm) {
      setNotice({ tone: 'error', text: 'The new password and its confirmation don’t match.' });
      return;
    }
    if (next === current) {
      setNotice({ tone: 'error', text: 'Choose a password different from the current one.' });
      return;
    }
    setBusy(true);
    try {
      await changePassword(accessToken, current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setNotice({ tone: 'ok', text: 'Password changed. Other devices are signed out, and you’ll be asked to sign in again with the new one.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof ApiError ? error.message : 'Couldn’t change the password. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  const input = 'rounded-md border border-border-color px-3 py-2';
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex max-w-md flex-col gap-3 rounded-lg border border-border-color bg-surface p-5"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div>
        <p className="font-medium">Your password</p>
        {email ? <p className="text-sm text-muted">Signed in as {email}</p> : null}
      </div>
      {/* Lets password managers file the change under the right account. */}
      <input type="email" value={email ?? ''} autoComplete="username" readOnly hidden />
      <label className="flex flex-col gap-1 text-sm">
        Current password
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        New password
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirm new password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className={input}
        />
      </label>
      {notice ? (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
          {notice.text}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="min-h-10 w-fit cursor-pointer rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { ApiError, useAuth } from '../../context/auth-context';

function AcceptInviteForm() {
  const { acceptInvite } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await acceptInvite(token, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'This invite link is invalid or has expired.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return <p className="p-8 text-sm text-danger">Missing invite token.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Join the team</h1>
      <p className="text-sm text-muted">Set a password to finish accepting your invite.</p>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-border-color px-3 py-2"
        />
        <p className="text-xs text-muted">At least 8 characters.</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50"
      >
        {isSubmitting ? 'Joining…' : 'Accept invite'}
      </button>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Suspense fallback={null}>
        <AcceptInviteForm />
      </Suspense>
    </main>
  );
}

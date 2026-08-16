'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ThemeToggle } from '../../components/ui/theme-toggle';
import { ApiError } from '../../context/auth-context';
import { apiFetch } from '../../lib/api-client';

export default function RegisterAgencyPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch('/auth/register-agency', { method: 'POST', body: { name, email, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-background p-8">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border-color bg-surface p-8"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="space-y-1 text-center">
          <p className="font-mono text-sm font-semibold tracking-tight text-accent">QRHub for Agencies</p>
          <h1 className="text-2xl font-semibold">Become a reseller</h1>
          <p className="text-sm text-muted">
            Get your own referral link, onboard clients under your agency, and track them from one dashboard.
          </p>
        </div>

        {done ? (
          <div className="space-y-3 text-center">
            <p className="text-sm">
              Your agency account has been created and is <span className="font-medium">pending approval</span>.
              A Super Admin needs to activate it before your referral link goes live.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="name" className="text-sm font-medium">
                Agency name
              </label>
              <input
                id="name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border-color bg-background px-3 py-2 outline-none transition-colors focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border-color bg-background px-3 py-2 outline-none transition-colors focus:border-accent"
              />
            </div>

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
                className="w-full rounded-md border border-border-color bg-background px-3 py-2 outline-none transition-colors focus:border-accent"
              />
              <p className="text-xs text-muted">At least 8 characters.</p>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {isSubmitting ? 'Creating agency…' : 'Create agency account'}
            </motion.button>

            <p className="text-center text-sm text-muted">
              Signing up a single business?{' '}
              <Link href="/register" className="font-medium text-accent underline">
                Register as a client
              </Link>
            </p>
          </form>
        )}
      </motion.div>
    </main>
  );
}

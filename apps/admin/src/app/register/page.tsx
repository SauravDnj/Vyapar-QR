'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { ThemeToggle } from '../../components/ui/theme-toggle';
import { ApiError, useAuth } from '../../context/auth-context';

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A referral link (`/register?agency=<slug>`) — stashed for the
  // business-info onboarding step, which is the actual Client-creation
  // point, to associate the new client with the referring agency.
  useEffect(() => {
    const agencySlug = searchParams.get('agency');
    if (agencySlug) {
      sessionStorage.setItem('qrhub_agency_slug', agencySlug);
    }
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full max-w-sm space-y-4 rounded-lg border border-border-color bg-surface p-8"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="space-y-1 text-center">
        <p className="font-mono text-sm font-semibold tracking-tight text-accent">QRHub</p>
        <h1 className="text-2xl font-semibold">Create your account</h1>
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
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </motion.button>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-accent underline">
          Sign in
        </Link>
      </p>
      <p className="text-center text-sm text-muted">
        Running an agency?{' '}
        <Link href="/register-agency" className="font-medium text-accent underline">
          Register as a reseller
        </Link>
      </p>
    </motion.form>
  );
}

export default function RegisterPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background p-8">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}

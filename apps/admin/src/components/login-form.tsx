'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiError, useAuth } from '../context/auth-context';

export function LoginForm({
  brandName,
  logoUrl,
  showRegisterLink = true,
}: {
  /** Defaults to "QRHub" — set for a white-label client's branded login page. */
  brandName?: string;
  logoUrl?: string | null;
  /** Hidden on branded per-client login pages — self-registration doesn't
   * make sense in that context. */
  showRegisterLink?: boolean;
}) {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await login(email, password);
      router.push(user.role === 'super_admin' ? '/super-admin' : user.role === 'agency_admin' ? '/agency' : '/dashboard');
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
      <div className="space-y-2 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brandName ?? 'Logo'} className="mx-auto h-12 w-12 rounded-md object-contain" />
        ) : (
          <p className="font-mono text-sm font-semibold tracking-tight text-accent">{brandName ?? 'QRHub'}</p>
        )}
        <h1 className="text-2xl font-semibold">Sign in</h1>
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-border-color bg-background px-3 py-2 outline-none transition-colors focus:border-accent"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <motion.button
        type="submit"
        disabled={isSubmitting}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </motion.button>

      {showRegisterLink && (
        <p className="text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-accent underline">
            Register
          </Link>
        </p>
      )}
    </motion.form>
  );
}

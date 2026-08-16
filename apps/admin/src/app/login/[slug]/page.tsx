'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LoginForm } from '../../../components/login-form';
import { ThemeToggle } from '../../../components/ui/theme-toggle';
import { getBranding, type ClientBranding } from '../../../lib/branding-api';

/** P4-03 — a white-label client's own branded login page (e.g. for an
 * agency reselling the platform under its own name). Falls back to the
 * generic /login for any slug that isn't on a whiteLabel-enabled plan,
 * rather than showing a half-branded page. */
export default function ClientLoginPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [branding, setBranding] = useState<ClientBranding | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await getBranding(params.slug);
        if (!result.whiteLabelEnabled) {
          router.replace('/login');
          return;
        }
        setBranding(result);
      } catch {
        router.replace('/login');
      }
    })();
  }, [params.slug, router]);

  if (!branding) {
    return <main className="flex flex-1 items-center justify-center bg-background p-8" />;
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-background p-8">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <LoginForm brandName={branding.businessName} logoUrl={branding.logoUrl} showRegisterLink={false} />
    </main>
  );
}

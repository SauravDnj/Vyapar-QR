'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../components/protected-route';
import { QrStudio, studioBrandFrom } from '../../components/qr-studio';
import { StatCard } from '../../components/ui/stat-card';
import { useAuth } from '../../context/auth-context';
import { getAnalyticsSummary, type AnalyticsSummary } from '../../lib/analytics-api';
import { getOnboardingStatus, type OnboardingStatus } from '../../lib/onboarding-api';
import { getQrCode, regenerateQrCode, type QrCodeInfo } from '../../lib/qr-api';

const LANDING_APP_URL = process.env.NEXT_PUBLIC_LANDING_APP_URL ?? 'http://localhost:3002';

function QrCodeSection({ accessToken, status }: { accessToken: string; status: OnboardingStatus }) {
  const [qrCode, setQrCode] = useState<QrCodeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const slug = status.client?.slug ?? 'my-page';

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setQrCode(await getQrCode(accessToken));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      setQrCode(await regenerateQrCode(accessToken));
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleRestyle(style: { foregroundColor?: string; backgroundColor?: string; logoEnabled?: boolean }) {
    setIsRegenerating(true);
    try {
      setQrCode(await regenerateQrCode(accessToken, style));
    } finally {
      setIsRegenerating(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 rounded-md border border-border-color p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="font-medium">QR code &amp; posters</p>
          <p className="text-sm text-muted">
            {LANDING_APP_URL}/site/{slug}
            {qrCode ? ` · ${String(qrCode.scanCount)} scans` : ''}
          </p>
        </div>
        {qrCode ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex min-h-10 items-center gap-2">
              Code colour
              <input
                type="color"
                value={qrCode.foregroundColor ?? '#1c1917'}
                onChange={(e) => void handleRestyle({ foregroundColor: e.target.value })}
                disabled={isRegenerating}
                className="h-8 w-8 cursor-pointer rounded border border-border-color bg-transparent p-0"
              />
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={qrCode.logoEnabled}
                onChange={(e) => void handleRestyle({ logoEnabled: e.target.checked })}
                disabled={isRegenerating}
              />
              Logo in the saved code image
            </label>
            <button
              disabled={isRegenerating}
              onClick={() => void handleRegenerate()}
              className="min-h-10 rounded-md border border-border-color px-3 text-sm disabled:opacity-50"
            >
              {isRegenerating ? 'Updating…' : 'Regenerate'}
            </button>
          </div>
        ) : null}
      </div>

      {qrCode ? (
        <QrStudio
          targetUrl={qrCode.targetUrl}
          foreground={qrCode.foregroundColor}
          brand={studioBrandFrom(status, LANDING_APP_URL)}
          fileBase={slug}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">No QR code yet.</p>
          <button
            disabled={isRegenerating}
            onClick={() => void handleRegenerate()}
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {isRegenerating ? 'Creating…' : 'Create my QR code'}
          </button>
        </div>
      )}
    </section>
  );
}

function AnalyticsWidget({ accessToken }: { accessToken: string }) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        setSummary(await getAnalyticsSummary(accessToken));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken]);

  if (isLoading || !summary) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Page views (7d)" value={summary.pageViews} />
      <StatCard label="Button clicks (7d)" value={summary.buttonClicks} />
      <StatCard label="QR scans (7d)" value={summary.qrScans} />
      <StatCard label="WhatsApp clicks (7d)" value={summary.whatsappClicks} />
    </div>
  );
}

function DashboardContent() {
  const { user, accessToken, logout, isImpersonating } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        setStatus(await getOnboardingStatus(accessToken));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const isPublished = status?.landingPage?.status === 'published';

  return (
    <>
      <h1 className="text-2xl font-semibold">Client dashboard</h1>
      <p>Signed in as {user?.email}</p>

      {isLoading ? (
        <p>Loading…</p>
      ) : isPublished && status?.client ? (
        <div className="flex flex-col gap-2 rounded-md border border-border-color p-4">
          <p className="font-medium">Your page is live</p>
          <a
            href={`${LANDING_APP_URL}/site/${status.client.slug}`}
            target="_blank"
            rel="noreferrer"
            className="w-fit text-emerald-700 underline"
          >
            {LANDING_APP_URL}/site/{status.client.slug}
          </a>
          <div className="flex gap-2">
            <a href="/onboarding" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Edit my page
            </a>
            <a href="/dashboard/theme" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Change theme
            </a>
            <a href="/dashboard/leads" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Leads
            </a>
            <a href="/dashboard/locations" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Locations
            </a>
            <a href="/dashboard/qr-codes" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Promo QR codes
            </a>
            <a href="/dashboard/testimonials" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Testimonials
            </a>
            <a href="/dashboard/loyalty" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Loyalty
            </a>
            <a href="/dashboard/coupons" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Coupons
            </a>
            <a href="/dashboard/bookings" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Bookings
            </a>
            <a href="/dashboard/reviews" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Reviews
            </a>
            <a href="/dashboard/analytics" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Analytics
            </a>
            <a href="/dashboard/billing" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Billing
            </a>
            <a href="/dashboard/domain" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Custom domain
            </a>
            <a href="/dashboard/translations" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Languages
            </a>
            <a href="/dashboard/staff" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Team
            </a>
            <a href="/dashboard/webhooks" className="w-fit rounded-md border border-border-color px-3 py-1 text-sm">
              Google Sheets &amp; webhooks
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border border-border-color p-4">
          <p>You haven&apos;t finished setting up your page yet.</p>
          <a href="/onboarding" className="w-fit rounded-md bg-accent px-4 py-2 text-accent-foreground">
            Continue setup
          </a>
        </div>
      )}

      {!isLoading && isPublished && status?.client && accessToken && (
        <QrCodeSection accessToken={accessToken} status={status} />
      )}

      {!isLoading && isPublished && accessToken && <AnalyticsWidget accessToken={accessToken} />}

      {!isImpersonating && (
        <button onClick={() => void handleLogout()} className="w-fit rounded-md border border-border-color px-4 py-2">
          Sign out
        </button>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <DashboardContent />
    </ProtectedRoute>
  );
}

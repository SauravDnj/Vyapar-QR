'use client';

import { useCallback, useEffect, useState } from 'react';

import { ConversionFunnel } from '../../../components/conversion-funnel';
import { ProtectedRoute } from '../../../components/protected-route';
import { TimeseriesChart } from '../../../components/timeseries-chart';
import { StatCard } from '../../../components/ui/stat-card';
import { useAuth } from '../../../context/auth-context';
import { ApiError, getAnalyticsFunnel, getAnalyticsTimeseries, type FunnelStage, type TimeseriesPoint } from '../../../lib/analytics-api';

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

function AnalyticsContent() {
  const { accessToken } = useAuth();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<TimeseriesPoint[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setMessage(null);
    setLocked(false);
    try {
      const [timeseries, funnelStages] = await Promise.all([getAnalyticsTimeseries(accessToken, days), getAnalyticsFunnel(accessToken, days)]);
      setData(timeseries);
      setFunnel(funnelStages);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setLocked(true);
      } else {
        setMessage('Failed to load analytics.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, days]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  const totals = data.reduce(
    (acc, point) => ({
      pageViews: acc.pageViews + point.pageViews,
      buttonClicks: acc.buttonClicks + point.buttonClicks,
      qrScans: acc.qrScans + point.qrScans,
    }),
    { pageViews: 0, buttonClicks: 0, qrScans: 0 },
  );

  return (
    <>
      <h1 className="text-2xl font-semibold">Analytics</h1>

      {locked ? (
        <div className="w-fit max-w-md rounded-md border border-warning bg-warning-bg p-4 text-sm text-warning">
          <p className="font-medium">Full analytics is a Pro/Business feature.</p>
          <p className="mt-1">
            Upgrade your plan from{' '}
            <a href="/dashboard/billing" className="underline">
              Billing
            </a>{' '}
            to see page views, button clicks, and QR scans charted over time.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDays(option.value)}
                className={`rounded-md border border-border-color px-3 py-1.5 text-sm ${days === option.value ? 'bg-accent text-accent-foreground' : ''}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {message && <p className="text-sm text-danger">{message}</p>}

          {isLoading ? (
            <p>Loading…</p>
          ) : data.length === 0 ? (
            <p className="text-muted">No data yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Page views" value={totals.pageViews} />
                <StatCard label="Button clicks" value={totals.buttonClicks} />
                <StatCard label="QR scans" value={totals.qrScans} />
              </div>
              <div className="rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                <TimeseriesChart data={data} />
              </div>
              {funnel.length > 0 && (
                <div className="rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <p className="mb-3 text-sm font-medium">Conversion funnel</p>
                  <ConversionFunnel stages={funnel} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <AnalyticsContent />
    </ProtectedRoute>
  );
}

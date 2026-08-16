'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { TimeseriesChart } from '../../../components/timeseries-chart';
import { useAuth } from '../../../context/auth-context';
import { getAdminAnalyticsTimeseries, type TimeseriesPoint } from '../../../lib/analytics-api';

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

function AnalyticsContent() {
  const { accessToken } = useAuth();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<TimeseriesPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      setData(await getAdminAnalyticsTimeseries(accessToken, days));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, days]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Platform analytics</h1>
      <p className="text-sm text-muted">
        Page views, button clicks, and QR scans summed across every client.
      </p>

      <div className="flex items-center gap-2">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setDays(option.value)}
            className={`rounded border border-border-color px-3 py-1.5 text-sm ${days === option.value ? 'bg-accent text-accent-foreground' : ''}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-muted">No data yet.</p>
      ) : (
        <TimeseriesChart data={data} />
      )}
    </>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <AnalyticsContent />
    </ProtectedRoute>
  );
}

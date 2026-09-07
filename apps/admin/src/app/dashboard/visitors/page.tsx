'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { StatCard } from '../../../components/ui/stat-card';
import { useAuth } from '../../../context/auth-context';
import {
  getVisitorStats,
  listVisitors,
  type PaginatedVisitors,
  type VisitorStats,
} from '../../../lib/visitors-api';

export default function VisitorsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <VisitorsContent />
    </ProtectedRoute>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${String(days)}d ago` : new Date(iso).toLocaleDateString();
}

function VisitorsContent() {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [visitors, setVisitors] = useState<PaginatedVisitors | null>(null);
  const [identifiedOnly, setIdentifiedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [statsResult, listResult] = await Promise.all([
        getVisitorStats(accessToken),
        listVisitors(accessToken, { page, identifiedOnly }),
      ]);
      setStats(statsResult);
      setVisitors(listResult);
    } catch {
      setError('Could not load your scan activity. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, identifiedOnly]);

  useEffect(() => {
    // Wrapped rather than called directly: `load` sets state on its first
    // synchronous line, which inside an effect body triggers a cascading
    // render. The async IIFE defers that to a microtask.
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Scan activity</h1>
        <p className="text-sm text-muted">
          Everyone who scanned your QR code. A scan is anonymous until someone gets in
          touch — once they do, their whole scan history is attached to them here.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg p-3 text-sm">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="People" value={stats?.totalVisitors ?? '—'} />
        <StatCard label="Total scans" value={stats?.totalScans ?? '—'} />
        <StatCard label="Came back" value={stats?.returningVisitors ?? '—'} />
        <StatCard
          label="Got in touch"
          value={stats ? `${String(stats.identified)} (${String(stats.conversionRate)}%)` : '—'}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={identifiedOnly}
            onChange={(event) => {
              setIdentifiedOnly(event.target.checked);
              setPage(1);
            }}
            className="size-4 cursor-pointer"
          />
          Only show people who got in touch
        </label>
      </div>

      {loading && !visitors ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : visitors && visitors.data.length === 0 ? (
        <div className="rounded-lg border border-border-color bg-surface p-8 text-center">
          <p className="font-medium">No scans yet</p>
          <p className="mt-1 text-sm text-muted">
            {identifiedOnly
              ? 'Nobody who scanned has left their details yet.'
              : 'Once someone scans your QR code, they will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
          <table className="w-full min-w-[46rem] text-sm">
            <caption className="sr-only">People who scanned your QR code</caption>
            <thead className="border-b border-border-color text-left">
              <tr className="font-mono text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3">Who</th>
                <th scope="col" className="px-4 py-3">Scans</th>
                <th scope="col" className="px-4 py-3">Device</th>
                <th scope="col" className="px-4 py-3">Location</th>
                <th scope="col" className="px-4 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {visitors?.data.map((visitor) => (
                <tr key={visitor.id} className="border-b border-border-color last:border-0">
                  <td className="px-4 py-3">
                    {visitor.lead ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{visitor.lead.name}</span>
                        <span className="font-mono text-xs text-muted">{visitor.lead.phone}</span>
                      </div>
                    ) : (
                      <Badge tone="neutral">Anonymous</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {visitor.scanCount}
                    {visitor.scanCount > 1 ? (
                      <span className="ml-2 text-xs text-success">returning</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {[visitor.device, visitor.os].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted">{visitor.location ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{relativeTime(visitor.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visitors && visitors.total > visitors.pageSize ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {visitors.page} of {Math.ceil(visitors.total / visitors.pageSize)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
              }}
              className="min-h-11 cursor-pointer rounded-lg border border-border-color px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= Math.ceil(visitors.total / visitors.pageSize)}
              onClick={() => {
                setPage((p) => p + 1);
              }}
              className="min-h-11 cursor-pointer rounded-lg border border-border-color px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted">
        A QR scan carries no name, phone or email — the browser doesn&apos;t provide it.
        What you see here is what a scan genuinely tells us: how often, on what kind of
        device, and roughly where. It becomes a real contact the moment someone submits
        the form, messages you, or marks a payment.
      </p>
    </div>
  );
}

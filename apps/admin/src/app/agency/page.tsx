'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../components/protected-route';
import { Badge, type BadgeTone } from '../../components/ui/badge';
import { useAuth } from '../../context/auth-context';
import { getAgencyStats, getMyAgency, listAgencyClients, type Agency, type AgencyClient, type AgencyStats } from '../../lib/agency-api';

const CLIENT_STATUS_TONE: Record<AgencyClient['status'], BadgeTone> = {
  pending: 'warning',
  active: 'success',
  suspended: 'danger',
  rejected: 'neutral',
};

function AgencyContent() {
  const { accessToken } = useAuth();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [stats, setStats] = useState<AgencyStats | null>(null);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [agencyResult, statsResult, clientsResult] = await Promise.all([
        getMyAgency(accessToken),
        getAgencyStats(accessToken),
        listAgencyClients(accessToken),
      ]);
      setAgency(agencyResult);
      setStats(statsResult);
      setClients(clientsResult);
    } catch {
      setError('Failed to load your agency dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  if (isLoading || !agency) {
    return <p>Loading…</p>;
  }

  const referralUrl = typeof window !== 'undefined' ? `${window.location.origin}/register?agency=${agency.slug}` : '';

  async function copyLink() {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{agency.name}</h1>
      {error && <p className="text-sm text-danger">{error}</p>}

      {agency.status !== 'active' && (
        <div className="rounded-md border border-warning bg-warning-bg p-4 text-sm text-warning">
          {agency.status === 'pending'
            ? 'Your agency is pending Super Admin approval. Your referral link will start working once approved.'
            : 'Your agency has been suspended. Contact the QRHub team for details.'}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-sm font-medium">Your referral link</p>
        <p className="text-sm text-muted">Share this with clients — anyone who signs up through it is added to your agency.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded border border-border-color bg-background px-3 py-2 text-xs">{referralUrl}</code>
          <button onClick={() => void copyLink()} className="rounded-md border border-border-color px-3 py-2 text-sm">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="rounded-md border border-border-color p-4">
          <p className="text-sm text-muted">Total clients</p>
          <p className="text-2xl font-semibold">{stats?.totalClients ?? 0}</p>
        </div>
        <div className="rounded-md border border-border-color p-4">
          <p className="text-sm text-muted">Active clients</p>
          <p className="text-2xl font-semibold">{stats?.activeClients ?? 0}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold">Your clients</h2>
      {clients.length === 0 ? (
        <p className="text-muted">No clients yet — share your referral link above to get started.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-color bg-surface" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-color font-mono text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-border-color last:border-0">
                  <td className="px-4 py-3 font-medium">{client.businessName}</td>
                  <td className="px-4 py-3">{client.user.email}</td>
                  <td className="px-4 py-3">{client.subscriptions[0]?.plan.name ?? <span className="text-muted">None</span>}</td>
                  <td className="px-4 py-3">
                    <Badge tone={CLIENT_STATUS_TONE[client.status]}>{client.status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">{new Date(client.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AgencyPage() {
  return (
    <ProtectedRoute allowedRoles={['agency_admin']}>
      <AgencyContent />
    </ProtectedRoute>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge, type BadgeTone } from '../../../components/ui/badge';
import { useAuth } from '../../../context/auth-context';
import { listAgencies, transitionAgency, type AdminAgency, type AgencyTransition } from '../../../lib/admin-api';

const STATUS_TONE: Record<AdminAgency['status'], BadgeTone> = {
  pending: 'warning',
  active: 'success',
  suspended: 'danger',
};

function AgenciesContent() {
  const { accessToken } = useAuth();
  const [agencies, setAgencies] = useState<AdminAgency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      setAgencies(await listAgencies(accessToken));
    } catch {
      setError('Failed to load agencies.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleTransition(id: string, action: AgencyTransition) {
    if (!accessToken) return;
    setBusyId(id);
    try {
      await transitionAgency(accessToken, id, action);
      await refresh();
    } catch {
      setError(`Failed to ${action} agency.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Agencies</h1>
      <p className="text-sm text-muted">
        Resellers who onboard their own clients via a referral link. Approve a new agency to activate its
        <code className="mx-1 font-mono text-xs">/register?agency=&lt;slug&gt;</code> link.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}

      {isLoading ? (
        <p>Loading…</p>
      ) : agencies.length === 0 ? (
        <p className="text-muted">No agencies have signed up yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-color bg-surface" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-color font-mono text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Agency</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Referral slug</th>
                <th className="px-4 py-3">Clients</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {agencies.map((agency) => (
                <tr key={agency.id} className="border-b border-border-color last:border-0">
                  <td className="px-4 py-3 font-medium">{agency.name}</td>
                  <td className="px-4 py-3">{agency.user.email}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{agency.slug}</td>
                  <td className="px-4 py-3">{agency._count.clients}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[agency.status]}>{agency.status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">{new Date(agency.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {agency.status === 'pending' && (
                        <button
                          disabled={busyId === agency.id}
                          onClick={() => void handleTransition(agency.id, 'approve')}
                          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {agency.status === 'active' && (
                        <button
                          disabled={busyId === agency.id}
                          onClick={() => void handleTransition(agency.id, 'suspend')}
                          className="rounded-md border border-border-color px-3 py-1 text-xs disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      )}
                      {agency.status === 'suspended' && (
                        <button
                          disabled={busyId === agency.id}
                          onClick={() => void handleTransition(agency.id, 'reactivate')}
                          className="rounded-md border border-border-color px-3 py-1 text-xs disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AgenciesPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <AgenciesContent />
    </ProtectedRoute>
  );
}

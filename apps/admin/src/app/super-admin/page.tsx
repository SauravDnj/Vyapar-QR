'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../components/protected-route';
import { Badge } from '../../components/ui/badge';
import { StatCard } from '../../components/ui/stat-card';
import { useAuth } from '../../context/auth-context';
import {
  getBillingReport,
  listClients,
  transitionClient,
  type AdminClient,
  type BillingReport,
} from '../../lib/admin-api';

function SuperAdminHome() {
  const { accessToken } = useAuth();
  const [pending, setPending] = useState<AdminClient[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [report, setReport] = useState<BillingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [pendingResult, activeResult, billingReport] = await Promise.all([
        listClients(accessToken, { status: 'pending' }),
        listClients(accessToken, { status: 'active' }),
        getBillingReport(accessToken),
      ]);
      setPending(pendingResult.data);
      setActiveCount(activeResult.total);
      setReport(billingReport);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleTransition(id: string, action: 'approve' | 'reject') {
    if (!accessToken) return;
    await transitionClient(accessToken, id, action);
    await refresh();
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}
      >
        <StatCard label="Active clients" value={activeCount} />
        <StatCard label="MRR" value={`₹${(report?.mrr ?? 0).toLocaleString('en-IN')}`} />
        <StatCard label="Pending approvals" value={pending.length} />
        <StatCard label="Churned subscriptions" value={report?.churnedSubscriptions ?? 0} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Approval queue</h2>
          <Link href="/super-admin/clients" className="text-sm text-accent underline">
            View all clients →
          </Link>
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-muted">No pending approvals.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-color">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-color font-mono text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2">Business</th>
                  <th className="px-4 py-2">Owner</th>
                  <th className="px-4 py-2">Submitted</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((client) => (
                  <tr key={client.id} className="border-b border-border-color last:border-0">
                    <td className="px-4 py-2 font-medium">{client.businessName}</td>
                    <td className="px-4 py-2 text-muted">{client.user.email}</td>
                    <td className="px-4 py-2 text-muted">
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone="warning">Pending</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleTransition(client.id, 'approve')}
                          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => void handleTransition(client.id, 'reject')}
                          className="rounded-md border border-border-color px-3 py-1 text-xs"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function SuperAdminPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <SuperAdminHome />
    </ProtectedRoute>
  );
}

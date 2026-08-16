'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge, type BadgeTone } from '../../../components/ui/badge';
import { Drawer } from '../../../components/ui/drawer';
import { useAuth } from '../../../context/auth-context';
import {
  impersonateClient,
  listClients,
  transitionClient,
  type AdminClient,
  type ClientTransition,
} from '../../../lib/admin-api';

const STATUS_TABS = ['', 'pending', 'active', 'suspended', 'rejected'] as const;
const STATUS_LABEL: Record<string, string> = {
  '': 'All',
  pending: 'Pending',
  active: 'Active',
  suspended: 'Suspended',
  rejected: 'Rejected',
};
const STATUS_TONE: Record<AdminClient['status'], BadgeTone> = {
  pending: 'warning',
  active: 'success',
  suspended: 'danger',
  rejected: 'neutral',
};

function ClientDrawer({
  client,
  isOpen,
  onClose,
  onTransition,
  onImpersonate,
}: {
  client: AdminClient | null;
  isOpen: boolean;
  onClose: () => void;
  onTransition: (id: string, action: ClientTransition) => Promise<void>;
  onImpersonate: (id: string) => Promise<void>;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [displayClient, setDisplayClient] = useState(client);

  // Adjust state during render when a new client is selected, rather than
  // in an effect — React's recommended pattern for syncing state to a
  // changed prop, and avoids an extra post-mount render.
  if (client && client !== displayClient) {
    setDisplayClient(client);
  }

  async function run(action: () => Promise<void>) {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  }

  if (!displayClient) {
    return <Drawer isOpen={isOpen} onClose={onClose}>{null}</Drawer>;
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold">{displayClient.businessName}</p>
          <p className="text-sm text-muted">{displayClient.user.email}</p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close drawer">
          ✕
        </button>
      </div>

      <Badge tone={STATUS_TONE[displayClient.status]}>{displayClient.status}</Badge>

      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted">Slug</p>
        <p className="font-mono">{displayClient.slug}</p>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted">Joined</p>
        <p className="font-mono">{new Date(displayClient.createdAt).toLocaleDateString()}</p>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {displayClient.status === 'pending' && (
          <>
            <button
              disabled={isBusy}
              onClick={() => void run(() => onTransition(displayClient.id, 'approve'))}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={isBusy}
              onClick={() => void run(() => onTransition(displayClient.id, 'reject'))}
              className="rounded-md border border-border-color px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        {displayClient.status === 'active' && (
          <button
            disabled={isBusy}
            onClick={() => void run(() => onTransition(displayClient.id, 'suspend'))}
            className="rounded-md border border-border-color px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Suspend
          </button>
        )}
        {displayClient.status === 'suspended' && (
          <button
            disabled={isBusy}
            onClick={() => void run(() => onTransition(displayClient.id, 'reactivate'))}
            className="rounded-md border border-border-color px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Reactivate
          </button>
        )}
        <button
          disabled={isBusy}
          onClick={() => void run(() => onImpersonate(displayClient.id))}
          className="rounded-md border border-border-color px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Impersonate
        </button>
      </div>
    </Drawer>
  );
}

function ClientsContent() {
  const { accessToken, startImpersonation } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listClients(accessToken, {
        status: status || undefined,
        search: search || undefined,
      });
      setClients(result.data);
    } catch {
      setError('Failed to load clients.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, status, search]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleTransition(id: string, action: ClientTransition) {
    if (!accessToken) return;
    try {
      await transitionClient(accessToken, id, action);
      setSelected(null);
      await refresh();
    } catch {
      setError(`Failed to ${action} client.`);
    }
  }

  async function handleImpersonate(id: string) {
    if (!accessToken) return;
    try {
      const { accessToken: impersonationToken } = await impersonateClient(accessToken, id);
      await startImpersonation(impersonationToken);
      router.push('/dashboard');
    } catch {
      setError('Failed to impersonate client.');
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Clients</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-border-color font-mono text-sm">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatus(tab)}
              className={`border-l border-border-color px-3 py-1.5 first:border-l-0 ${status === tab ? 'bg-accent text-accent-foreground' : ''}`}
            >
              {STATUS_LABEL[tab]}
            </button>
          ))}
        </div>
        <input
          placeholder="Search business name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-64 flex-1 rounded-md border border-border-color px-3 py-1.5 text-sm"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {isLoading ? (
        <p>Loading…</p>
      ) : clients.length === 0 ? (
        <p className="text-muted">No clients found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-color bg-surface" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-color font-mono text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => setSelected(client)}
                  className="cursor-pointer border-b border-border-color last:border-0 hover:bg-border-color/20"
                >
                  <td className="px-4 py-3 font-medium">{client.businessName}</td>
                  <td className="px-4 py-3">{client.user.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[client.status]}>{client.status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">{new Date(client.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClientDrawer
        client={selected}
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        onTransition={handleTransition}
        onImpersonate={handleImpersonate}
      />
    </>
  );
}

export default function ClientsPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <ClientsContent />
    </ProtectedRoute>
  );
}

'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { useAuth } from '../../../context/auth-context';
import { listAuditLog, type AuditLogEntry } from '../../../lib/admin-api';

const ENTITIES = ['', 'Client', 'Plan', 'Theme', 'Agency'];

function actionTone(action: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (action.includes('approve') || action.includes('reactivate')) return 'success';
  if (action.includes('suspend') || action.includes('reject') || action.includes('archive')) return 'warning';
  if (action.includes('delete') || action.includes('remove')) return 'danger';
  return 'neutral';
}

function AuditLogContent() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const pageSize = 25;

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await listAuditLog(accessToken, { page, entity: entity || undefined, action: action || undefined });
      setEntries(result.data);
      setTotal(result.total);
    } catch {
      setError('Failed to load audit log.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page, entity, action]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <p className="text-sm text-muted">Every mutating action taken by a Super Admin — client/agency/plan/theme changes, and who made them.</p>
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <select
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
          className="rounded border border-border-color px-3 py-1.5 text-sm"
        >
          {ENTITIES.map((e) => (
            <option key={e || 'all'} value={e}>
              {e || 'All entities'}
            </option>
          ))}
        </select>
        <input
          placeholder="Filter by action…"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="rounded border border-border-color px-3 py-1.5 text-sm"
        />
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-muted">No matching audit log entries.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-color">
                <th className="py-2">When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  <tr className="border-b border-border-color align-top">
                    <td className="whitespace-nowrap py-2 text-muted">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>{entry.actor?.email ?? <span className="text-muted">System</span>}</td>
                    <td>
                      <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>
                    </td>
                    <td className="font-mono text-xs text-muted">
                      {entry.entity}
                      <br />
                      {entry.entityId.slice(0, 8)}…
                    </td>
                    <td>
                      {entry.metaJson != null && (
                        <button
                          onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                          className="text-xs text-accent underline"
                        >
                          {expanded === entry.id ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === entry.id && entry.metaJson != null && (
                    <tr className="border-b border-border-color bg-border-color/10">
                      <td colSpan={5} className="p-3">
                        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted">
                          {JSON.stringify(entry.metaJson, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-border-color px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-border-color px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

export default function AuditLogPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <AuditLogContent />
    </ProtectedRoute>
  );
}

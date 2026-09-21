'use client';

import { useCallback, useEffect, useState } from 'react';

import { formatWhen, GoogleSheetsConnect } from '../../../components/google-sheets-connect';
import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  createWebhook,
  deleteWebhook,
  isAppsScriptUrl,
  listWebhooks,
  type Webhook,
  type WebhookEventType,
} from '../../../lib/webhooks-api';

/** Every event the API sends. This used to list three of the five that
 * existed, so payments and orders could never be subscribed to. */
const EVENT_TYPES: { type: WebhookEventType; label: string }[] = [
  { type: 'lead.created', label: 'New lead' },
  { type: 'lead.updated', label: 'Lead updated (status, notes, tags)' },
  { type: 'payment.claimed', label: 'Customer marked a payment as paid' },
  { type: 'payment.updated', label: 'Payment confirmed, cancelled or edited' },
  { type: 'feedback.received', label: 'Feedback or a Google review' },
  { type: 'order.created', label: 'New order' },
  { type: 'review.synced', label: 'Reviews synced' },
  { type: 'subscription.updated', label: 'Subscription changed' },
];

/** The Google Sheets connection: one still waiting for its URL, or one
 * pointing at an Apps Script web app. */
const isSheets = (webhook: Webhook) => webhook.url === '' || isAppsScriptUrl(webhook.url);

function WebhooksContent() {
  const { accessToken } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>(['lead.created']);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      setWebhooks(await listWebhooks(accessToken));
    } catch {
      setMessage('Failed to load webhooks.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  function toggleEvent(eventType: WebhookEventType) {
    setSelectedEvents((prev) =>
      prev.includes(eventType) ? prev.filter((e) => e !== eventType) : [...prev, eventType],
    );
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !url.trim() || selectedEvents.length === 0) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await createWebhook(accessToken, url.trim(), selectedEvents);
      setUrl('');
      await refresh();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to add webhook.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return;
    try {
      await deleteWebhook(accessToken, id);
      await refresh();
    } catch {
      setMessage('Failed to remove webhook.');
    }
  }

  const sheets = webhooks.find(isSheets) ?? null;
  const custom = webhooks.filter((webhook) => !isSheets(webhook));

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Integrations</h1>
      {message && <p className="text-sm text-danger">{message}</p>}

      {accessToken && !isLoading ? (
        <GoogleSheetsConnect accessToken={accessToken} connection={sheets} onChange={refresh} />
      ) : null}

      <div className="flex max-w-2xl flex-col gap-1 pt-2">
        <h2 className="text-lg font-semibold">Custom webhooks</h2>
        <p className="text-sm text-muted">
          Send a signed POST to your own endpoint on any of these events — for Zapier, Make, or your own system.
        </p>
      </div>

      <form onSubmit={(e) => void handleCreate(e)} className="flex max-w-md flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Endpoint URL
          <input
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/webhooks/vyaparqr"
            className="rounded-md border border-border-color px-3 py-2"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          Events
          {EVENT_TYPES.map(({ type, label }) => (
            <label key={type} className="flex items-center gap-2">
              <input type="checkbox" checked={selectedEvents.includes(type)} onChange={() => toggleEvent(type)} />
              {label} <code className="text-xs text-muted">{type}</code>
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground disabled:opacity-50"
        >
          {isSaving ? 'Adding…' : 'Add webhook'}
        </button>
      </form>

      {isLoading ? (
        <p>Loading…</p>
      ) : custom.length === 0 ? (
        <p className="text-muted">No custom webhooks yet.</p>
      ) : (
        <div className="flex max-w-2xl flex-col gap-3">
          {custom.map((webhook) => (
            <div key={webhook.id} className="rounded-md border border-border-color p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium break-all">{webhook.url}</p>
                <button onClick={() => void handleDelete(webhook.id)} className="text-danger">
                  Remove
                </button>
              </div>
              <p className="mt-1 text-muted">Events: {webhook.eventTypes.join(', ')}</p>
              <p className="mt-1 text-xs text-muted">
                Verify each delivery with the <code>X-VyaparQR-Signature</code> header — HMAC-SHA256 of the raw body
                using this secret:
              </p>
              <code className="mt-1 block break-all text-xs">{webhook.secret}</code>
              {webhook.lastDeliveredAt ? (
                <p className={`mt-2 text-xs ${webhook.lastError ? 'text-danger' : 'text-success'}`}>
                  Last delivery <time suppressHydrationWarning>{formatWhen(webhook.lastDeliveredAt)}</time>:{' '}
                  {webhook.lastError ?? `OK${webhook.lastStatus ? ` (HTTP ${String(webhook.lastStatus)})` : ''}`}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function WebhooksPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin']}>
      <WebhooksContent />
    </ProtectedRoute>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  createWebhook,
  deleteWebhook,
  listWebhooks,
  type Webhook,
  type WebhookEventType,
} from '../../../lib/webhooks-api';

const EVENT_TYPES: WebhookEventType[] = ['lead.created', 'review.synced', 'subscription.updated'];

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

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Webhooks</h1>
      <p className="max-w-lg text-sm text-muted">
        Send a signed POST to your own endpoint when a new lead comes in, your reviews sync, or your subscription
        changes — connect Zapier, Make, or your own system.
      </p>
      {message && <p className="text-sm text-danger">{message}</p>}

      <form onSubmit={(e) => void handleCreate(e)} className="flex max-w-md flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Endpoint URL
          <input
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/webhooks/qrhub"
            className="rounded-md border border-border-color px-3 py-2"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          Events
          {EVENT_TYPES.map((eventType) => (
            <label key={eventType} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedEvents.includes(eventType)}
                onChange={() => toggleEvent(eventType)}
              />
              {eventType}
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
      ) : webhooks.length === 0 ? (
        <p className="text-muted">No webhooks yet.</p>
      ) : (
        <div className="flex max-w-2xl flex-col gap-3">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="rounded-md border border-border-color p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium break-all">{webhook.url}</p>
                <button onClick={() => void handleDelete(webhook.id)} className="text-danger">
                  Remove
                </button>
              </div>
              <p className="mt-1 text-muted">Events: {webhook.eventTypes.join(', ')}</p>
              <p className="mt-1 text-xs text-muted">
                Verify each delivery with the <code>X-QRHub-Signature</code> header — HMAC-SHA256 of the raw body
                using this secret:
              </p>
              <code className="mt-1 block break-all text-xs">{webhook.secret}</code>
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

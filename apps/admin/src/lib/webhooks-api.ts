import { ApiError, apiFetch } from './api-client';

/** Mirrors `WEBHOOK_EVENT_TYPES` in apps/api. This list used to stop at three,
 * so payments and orders could be sent by the API but never subscribed to. */
export type WebhookEventType =
  | 'lead.created'
  | 'lead.updated'
  | 'payment.claimed'
  | 'payment.updated'
  | 'feedback.received'
  | 'review.synced'
  | 'order.created'
  | 'subscription.updated';

export interface Webhook {
  id: string;
  url: string;
  secret: string;
  eventTypes: WebhookEventType[];
  isActive: boolean;
  createdAt: string;
  lastDeliveredAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
}

export interface DeliveryResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

export function listWebhooks(accessToken: string) {
  return apiFetch<Webhook[]>('/webhooks', { accessToken });
}

export function createWebhook(accessToken: string, url: string, eventTypes: WebhookEventType[]) {
  return apiFetch<Webhook>('/webhooks', { method: 'POST', body: { url, eventTypes }, accessToken });
}

export function deleteWebhook(accessToken: string, id: string) {
  return apiFetch<void>(`/webhooks/${id}`, { method: 'DELETE', accessToken });
}

/** Starts a Google Sheets connection: the secret now, the URL later. */
export function prepareSheetsWebhook(accessToken: string) {
  return apiFetch<Webhook>('/webhooks/sheets', { method: 'POST', accessToken });
}

export function connectWebhook(accessToken: string, id: string, url: string) {
  return apiFetch<Webhook>(`/webhooks/${id}/url`, { method: 'PATCH', body: { url }, accessToken });
}

export function testWebhook(accessToken: string, id: string) {
  return apiFetch<DeliveryResult>(`/webhooks/${id}/test`, { method: 'POST', accessToken });
}

export function backfillWebhook(accessToken: string, id: string) {
  return apiFetch<{ leads: number; payments: number; failed: number }>(`/webhooks/${id}/backfill`, {
    method: 'POST',
    accessToken,
  });
}

/** A Google Apps Script web app — the connection this page walks people
 * through. Anything else is treated as a general-purpose webhook. */
export function isAppsScriptUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'script.google.com' || host.endsWith('.googleusercontent.com');
  } catch {
    return false;
  }
}

export { ApiError };

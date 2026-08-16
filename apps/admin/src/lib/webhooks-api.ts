import { ApiError, apiFetch } from './api-client';

export type WebhookEventType = 'lead.created' | 'review.synced' | 'subscription.updated';

export interface Webhook {
  id: string;
  url: string;
  secret: string;
  eventTypes: WebhookEventType[];
  isActive: boolean;
  createdAt: string;
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

export { ApiError };

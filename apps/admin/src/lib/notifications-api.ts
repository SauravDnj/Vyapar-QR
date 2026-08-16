import { apiFetch } from './api-client';

export interface NotificationItem {
  id: string;
  type: 'lead' | 'testimonial' | 'low_rating_feedback' | 'whatsapp_needs_human' | 'order';
  message: string;
  createdAt: string;
  link: string;
}

export function listNotifications(accessToken: string) {
  return apiFetch<NotificationItem[]>('/notifications', { accessToken });
}

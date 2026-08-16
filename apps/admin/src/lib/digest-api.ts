import { apiFetch } from './api-client';

export function sendTestDigest(accessToken: string) {
  return apiFetch<void>('/digest/send-test', { method: 'POST', accessToken });
}

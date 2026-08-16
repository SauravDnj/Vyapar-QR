import { apiFetch } from './api-client';

export interface Translation {
  locale: string;
  content: Record<string, Record<string, string>>;
  updatedAt: string;
}

export function listTranslations(accessToken: string) {
  return apiFetch<Translation[]>('/translations', { accessToken });
}

export function saveTranslation(accessToken: string, locale: string, content: Record<string, Record<string, string>>) {
  return apiFetch<Translation>(`/translations/${encodeURIComponent(locale)}`, {
    method: 'PUT',
    body: { content },
    accessToken,
  });
}

export function deleteTranslation(accessToken: string, locale: string) {
  return apiFetch<void>(`/translations/${encodeURIComponent(locale)}`, { method: 'DELETE', accessToken });
}

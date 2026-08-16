import { apiFetch } from './api-client';

export interface ClientBranding {
  businessName: string;
  logoUrl: string | null;
  whiteLabelEnabled: boolean;
}

export function getBranding(slug: string) {
  return apiFetch<ClientBranding>(`/public/branding/${slug}`);
}

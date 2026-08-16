import { ApiError, apiFetch } from './api-client';

export type LeadStatus = 'new' | 'contacted' | 'converted' | 'lost';
export type LeadSource = 'contact_form' | 'whatsapp_click' | 'qr_scan';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  notes: string | null;
  tags: string[];
  createdAt: string;
}

export interface PaginatedLeads {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export function listLeads(accessToken: string, params: { status?: LeadStatus; search?: string; page?: number } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  const qs = query.toString();
  return apiFetch<PaginatedLeads>(`/leads${qs ? `?${qs}` : ''}`, { accessToken });
}

export function updateLead(accessToken: string, id: string, data: { status?: LeadStatus; notes?: string; tags?: string[] }) {
  return apiFetch<Lead>(`/leads/${id}`, { method: 'PATCH', body: data, accessToken });
}

export function sendLeadWhatsapp(accessToken: string, id: string, message: string) {
  return apiFetch<{ sent: boolean }>(`/leads/${id}/whatsapp`, { method: 'POST', body: { message }, accessToken });
}

export function requestLeadReview(accessToken: string, id: string) {
  return apiFetch<{ sent: boolean }>(`/leads/${id}/request-review`, { method: 'POST', accessToken });
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export async function downloadLeadsCsv(accessToken: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/leads/export`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to export leads.');
  }
  return response.blob();
}

export { ApiError };

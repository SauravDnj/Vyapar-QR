import { apiFetch } from './api-client';

import type { LeadStatus } from './leads-api';

export interface Visitor {
  id: string;
  scanCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  device: string | null;
  os: string | null;
  browser: string | null;
  referrer: string | null;
  /** City, region, country — whatever the edge could tell us. */
  location: string | null;
  lastQrId: string | null;
  /** Set once the visitor identified themselves. */
  lead: { id: string; name: string; phone: string; status: LeadStatus } | null;
}

export interface PaginatedVisitors {
  data: Visitor[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VisitorStats {
  totalVisitors: number;
  totalScans: number;
  returningVisitors: number;
  identified: number;
  conversionRate: number;
}

export function listVisitors(
  accessToken: string,
  params: { page?: number; identifiedOnly?: boolean } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.identifiedOnly) query.set('identifiedOnly', 'true');
  const qs = query.toString();
  return apiFetch<PaginatedVisitors>(`/visitors${qs ? `?${qs}` : ''}`, { accessToken });
}

export function getVisitorStats(accessToken: string) {
  return apiFetch<VisitorStats>('/visitors/stats', { accessToken });
}

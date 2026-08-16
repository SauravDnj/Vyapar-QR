import { apiFetch } from './api-client';

export interface Agency {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'suspended';
  createdAt: string;
}

export interface AgencyStats {
  totalClients: number;
  activeClients: number;
}

export interface AgencyClient {
  id: string;
  businessName: string;
  slug: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  createdAt: string;
  user: { email: string };
  subscriptions: { plan: { name: string } }[];
}

export function getMyAgency(accessToken: string) {
  return apiFetch<Agency>('/agency/me', { accessToken });
}

export function getAgencyStats(accessToken: string) {
  return apiFetch<AgencyStats>('/agency/stats', { accessToken });
}

export function listAgencyClients(accessToken: string) {
  return apiFetch<AgencyClient[]>('/agency/clients', { accessToken });
}

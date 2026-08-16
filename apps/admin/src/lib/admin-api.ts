import { apiFetch } from './api-client';

export interface AdminClient {
  id: string;
  businessName: string;
  slug: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  createdAt: string;
  user: { email: string };
}

export interface PaginatedClients {
  data: AdminClient[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Plan {
  id: string;
  name: string;
  price: string;
  billingCycle: 'monthly' | 'yearly';
  featuresJson: { analytics: boolean; customDomain: boolean; whiteLabel: boolean; digitalMenu: boolean };
  maxThemes: number;
  customDomainAllowed: boolean;
  isArchived: boolean;
}

export type ClientTransition = 'approve' | 'reject' | 'suspend' | 'reactivate';

export function listClients(accessToken: string, params: { status?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  const qs = query.toString();
  return apiFetch<PaginatedClients>(`/admin/clients${qs ? `?${qs}` : ''}`, { accessToken });
}

export function transitionClient(accessToken: string, id: string, action: ClientTransition) {
  return apiFetch<AdminClient>(`/admin/clients/${id}/${action}`, { method: 'PATCH', accessToken });
}

export function impersonateClient(accessToken: string, id: string) {
  return apiFetch<{ accessToken: string; expiresIn: string }>(`/admin/clients/${id}/impersonate`, {
    method: 'POST',
    accessToken,
  });
}

export function listPlans(accessToken: string) {
  return apiFetch<Plan[]>('/admin/plans', { accessToken });
}

export function createPlan(accessToken: string, plan: Omit<Plan, 'id' | 'isArchived' | 'price'> & { price: number }) {
  return apiFetch<Plan>('/admin/plans', { method: 'POST', body: plan, accessToken });
}

export function updatePlan(accessToken: string, id: string, plan: Partial<Plan>) {
  return apiFetch<Plan>(`/admin/plans/${id}`, { method: 'PATCH', body: plan, accessToken });
}

export function archivePlan(accessToken: string, id: string) {
  return apiFetch<Plan>(`/admin/plans/${id}`, { method: 'DELETE', accessToken });
}

export function getSettings(accessToken: string) {
  return apiFetch<Record<string, unknown>>('/admin/settings', { accessToken });
}

export function updateSettings(accessToken: string, values: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>('/admin/settings', { method: 'PUT', body: { values }, accessToken });
}

export interface RevenueMonth {
  month: string;
  revenue: number;
}

export interface BillingReport {
  mrr: number;
  activeClients: number;
  suspendedClients: number;
  churnedSubscriptions: number;
  revenueByMonth: RevenueMonth[];
}

export function getBillingReport(accessToken: string) {
  return apiFetch<BillingReport>('/admin/reports/billing', { accessToken });
}

export interface CatalogTheme {
  id: string;
  name: string;
  category: string;
  previewImageUrl: string | null;
  isPremium: boolean;
  isArchived: boolean;
}

export function listCatalogThemes(accessToken: string) {
  return apiFetch<CatalogTheme[]>('/themes', { accessToken });
}

export function listAdminThemes(accessToken: string) {
  return apiFetch<CatalogTheme[]>('/admin/themes', { accessToken });
}

export function createTheme(
  accessToken: string,
  theme: { name: string; category: string; previewImageUrl?: string; isPremium: boolean },
) {
  return apiFetch<CatalogTheme>('/admin/themes', { method: 'POST', body: theme, accessToken });
}

export function updateTheme(accessToken: string, id: string, theme: Partial<CatalogTheme>) {
  return apiFetch<CatalogTheme>(`/admin/themes/${id}`, { method: 'PATCH', body: theme, accessToken });
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  metaJson: unknown;
  createdAt: string;
  actor: { email: string; role: string } | null;
}

export interface PaginatedAuditLog {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export function listAuditLog(
  accessToken: string,
  params: { page?: number; entity?: string; action?: string } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.entity) query.set('entity', params.entity);
  if (params.action) query.set('action', params.action);
  const qs = query.toString();
  return apiFetch<PaginatedAuditLog>(`/admin/audit-log${qs ? `?${qs}` : ''}`, { accessToken });
}

export interface AdminAgency {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'suspended';
  createdAt: string;
  user: { email: string };
  _count: { clients: number };
}

export type AgencyTransition = 'approve' | 'suspend' | 'reactivate';

export function listAgencies(accessToken: string) {
  return apiFetch<AdminAgency[]>('/admin/agencies', { accessToken });
}

export function transitionAgency(accessToken: string, id: string, action: AgencyTransition) {
  return apiFetch<AdminAgency>(`/admin/agencies/${id}/${action}`, { method: 'PATCH', accessToken });
}

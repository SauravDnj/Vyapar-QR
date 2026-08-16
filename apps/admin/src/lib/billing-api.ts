import { ApiError, apiFetch } from './api-client';

export interface BillingPlan {
  id: string;
  name: string;
  price: string;
  billingCycle: 'monthly' | 'yearly';
  maxThemes: number;
  customDomainAllowed: boolean;
  isArchived: boolean;
  featuresJson?: { analytics: boolean; customDomain: boolean; whiteLabel: boolean };
}

export interface Subscription {
  id: string;
  status: 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired';
  currentPeriodEnd: string | null;
  plan: BillingPlan;
}

export interface Invoice {
  id: string;
  amount: string;
  status: 'pending' | 'paid' | 'failed';
  issuedAt: string;
}

export function listAvailablePlans(accessToken: string) {
  return apiFetch<BillingPlan[]>('/billing/plans', { accessToken });
}

export function getCurrentSubscription(accessToken: string) {
  return apiFetch<Subscription | null>('/billing/subscription', { accessToken });
}

export function listInvoices(accessToken: string) {
  return apiFetch<Invoice[]>('/billing/invoices', { accessToken });
}

export function checkout(accessToken: string, planId: string) {
  return apiFetch<{ checkoutUrl: string | null }>('/billing/checkout', { method: 'POST', body: { planId }, accessToken });
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export async function downloadInvoicePdf(accessToken: string, invoiceId: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/billing/invoices/${invoiceId}/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to download invoice.');
  }
  return response.blob();
}

export { ApiError };

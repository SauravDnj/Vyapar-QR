import { ApiError, apiFetch } from './api-client';

export type PaymentMethodType = 'gpay' | 'phonepe' | 'paytm' | 'other';
export type PaymentClaimStatus = 'claimed' | 'confirmed' | 'cancelled';

export interface PaymentClaim {
  id: string;
  amount: number | null;
  method: PaymentMethodType;
  status: PaymentClaimStatus;
  customerName: string | null;
  customerPhone: string | null;
  note: string | null;
  leadId: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export interface PaymentSummary {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  allTimeTotal: number;
  claimCount: number;
  confirmedCount: number;
  cancelledCount: number;
  byMethod: { method: PaymentMethodType; count: number; total: number }[];
}

export function listPayments(accessToken: string, status?: PaymentClaimStatus) {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<PaymentClaim[]>(`/payments${qs}`, { accessToken });
}

export function getPaymentSummary(accessToken: string) {
  return apiFetch<PaymentSummary>('/payments/summary', { accessToken });
}

export function setPaymentStatus(accessToken: string, id: string, status: PaymentClaimStatus) {
  return apiFetch<PaymentClaim>(`/payments/${id}`, { method: 'PATCH', body: { status }, accessToken });
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

/** The payments report, as a CSV that Excel opens with ₹ and Hindi intact. */
export async function downloadPaymentsCsv(accessToken: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/payments/export`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to export payments.');
  }
  return response.blob();
}

export { ApiError };

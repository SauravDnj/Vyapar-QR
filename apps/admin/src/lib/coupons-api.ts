import { apiFetch } from './api-client';

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountText: string;
  expiresAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
  createdAt: string;
}

export function listCoupons(accessToken: string) {
  return apiFetch<Coupon[]>('/coupons', { accessToken });
}

export function createCoupon(
  accessToken: string,
  data: { code: string; description: string; discountText: string; expiresAt?: string; maxRedemptions?: number },
) {
  return apiFetch<Coupon>('/coupons', { method: 'POST', accessToken, body: data });
}

export function updateCoupon(accessToken: string, id: string, data: { isActive?: boolean }) {
  return apiFetch<Coupon>(`/coupons/${id}`, { method: 'PATCH', accessToken, body: data });
}

export function deleteCoupon(accessToken: string, id: string) {
  return apiFetch<void>(`/coupons/${id}`, { method: 'DELETE', accessToken });
}

export function redeemCoupon(accessToken: string, code: string) {
  return apiFetch<Coupon>('/coupons/redeem', { method: 'POST', accessToken, body: { code } });
}

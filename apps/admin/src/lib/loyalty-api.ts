import { apiFetch } from './api-client';

export interface LoyaltyProgram {
  id: string;
  stampsRequired: number;
  rewardText: string;
  isActive: boolean;
}

export interface LoyaltyCard {
  id: string;
  customerPhone: string;
  stampCount: number;
  redemptionCount: number;
  createdAt: string;
}

export function getLoyaltyProgram(accessToken: string) {
  return apiFetch<LoyaltyProgram | null>('/loyalty/program', { accessToken });
}

export function saveLoyaltyProgram(accessToken: string, data: { stampsRequired: number; rewardText: string; isActive?: boolean }) {
  return apiFetch<LoyaltyProgram>('/loyalty/program', { method: 'PUT', accessToken, body: data });
}

export function listLoyaltyCards(accessToken: string) {
  return apiFetch<LoyaltyCard[]>('/loyalty/cards', { accessToken });
}

export function addLoyaltyStamp(accessToken: string, phone: string) {
  return apiFetch<LoyaltyCard>('/loyalty/stamp', { method: 'POST', accessToken, body: { phone } });
}

export function redeemLoyaltyCard(accessToken: string, id: string) {
  return apiFetch<LoyaltyCard>(`/loyalty/cards/${id}/redeem`, { method: 'POST', accessToken });
}

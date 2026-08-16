import { ApiError, apiFetch } from './api-client';

export interface VerificationRecord {
  host: string;
  type: 'TXT';
  value: string;
}

export interface DomainStatus {
  customDomain: string | null;
  verified: boolean;
  verificationRecord: VerificationRecord | null;
  dnsTarget: { apexA: string; subdomainCname: string } | null;
}

export function getDomainStatus(accessToken: string) {
  return apiFetch<DomainStatus>('/domains', { accessToken });
}

export function setDomain(accessToken: string, domain: string) {
  return apiFetch<DomainStatus>('/domains', { method: 'PUT', body: { domain }, accessToken });
}

export function verifyDomain(accessToken: string) {
  return apiFetch<{ verified: boolean; message?: string }>('/domains/verify', { method: 'POST', accessToken });
}

export { ApiError };

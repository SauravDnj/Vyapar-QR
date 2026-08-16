import { ApiError, apiFetch } from './api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export interface QrCodeInfo {
  id: string;
  targetUrl: string;
  imageUrl: string | null;
  svgImageUrl: string | null;
  scanCount: number;
  foregroundColor: string | null;
  backgroundColor: string | null;
  logoEnabled: boolean;
}

export interface AdditionalQrCode {
  id: string;
  label: string | null;
  targetUrl: string;
  imageUrl: string | null;
  svgImageUrl: string | null;
  scanCount: number;
  createdAt: string;
  foregroundColor: string | null;
  backgroundColor: string | null;
  logoEnabled: boolean;
  redirectUrl: string | null;
  expiresAt: string | null;
  maxScans: number | null;
}

export interface QrStyle {
  foregroundColor?: string;
  backgroundColor?: string;
  logoEnabled?: boolean;
}

export function getQrCode(accessToken: string) {
  return apiFetch<QrCodeInfo | null>('/qr', { accessToken });
}

export function regenerateQrCode(accessToken: string, style?: QrStyle) {
  return apiFetch<QrCodeInfo>('/qr/regenerate', { method: 'POST', accessToken, body: style ?? {} });
}

export function listAdditionalQrCodes(accessToken: string) {
  return apiFetch<AdditionalQrCode[]>('/qr/additional', { accessToken });
}

export function createAdditionalQrCode(accessToken: string, label: string) {
  return apiFetch<AdditionalQrCode>('/qr/additional', { method: 'POST', accessToken, body: { label } });
}

export function restyleAdditionalQrCode(accessToken: string, id: string, style: QrStyle) {
  return apiFetch<AdditionalQrCode>(`/qr/additional/${id}/style`, { method: 'POST', accessToken, body: style });
}

export function deleteAdditionalQrCode(accessToken: string, id: string) {
  return apiFetch<void>(`/qr/additional/${id}`, { method: 'DELETE', accessToken });
}

export interface SmartRedirectSettings {
  redirectUrl?: string;
  expiresAt?: string;
  maxScans?: number;
}

export function createBulkQrCodes(accessToken: string, labels: string[]) {
  return apiFetch<AdditionalQrCode[]>('/qr/additional/bulk', { method: 'POST', accessToken, body: { labels } });
}

export function setQrRedirectSettings(accessToken: string, id: string, settings: SmartRedirectSettings) {
  return apiFetch<AdditionalQrCode>(`/qr/additional/${id}/redirect`, { method: 'POST', accessToken, body: settings });
}

export function getQrScanTrend(accessToken: string, id: string) {
  return apiFetch<{ date: string; count: number }[]>(`/qr/${id}/trend`, { accessToken });
}

export async function getPrintSheetPdf(accessToken: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/qr/additional/sheet`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to generate print sheet.');
  }
  return response.blob();
}

export async function getPosterPdf(accessToken: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/qr/poster`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to generate poster.');
  }
  return response.blob();
}

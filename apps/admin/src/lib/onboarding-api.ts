import { ApiError } from './api-client';

import type { PaymentMethodType, SocialPlatform, ThemeContent } from '@qrhub/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export interface OnboardingClient {
  id: string;
  businessName: string;
  slug: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
}

export interface OnboardingLandingPage {
  themeId: string | null;
  contentJson: ThemeContent;
  status: 'draft' | 'published';
  accentColor: string | null;
}

export interface OnboardingPaymentMethod {
  id: string;
  type: PaymentMethodType;
  qrImageUrl: string | null;
  upiId: string | null;
  displayOrder: number;
}

export interface OnboardingSocialLink {
  id: string;
  platform: SocialPlatform;
  value: string;
  displayOrder: number;
}

export interface OnboardingGoogleReviewConfig {
  reviewLink: string | null;
  sheetId: string | null;
  sheetRange: string | null;
  googlePlaceId: string | null;
}

export interface OnboardingGalleryImage {
  id: string;
  imageUrl: string;
  displayOrder: number;
}

export interface OnboardingLocation {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  hours: string | null;
  displayOrder: number;
}

export interface OnboardingStatus {
  client: OnboardingClient | null;
  landingPage: OnboardingLandingPage | null;
  paymentMethods: OnboardingPaymentMethod[];
  socialLinks: OnboardingSocialLink[];
  googleReviewConfig: OnboardingGoogleReviewConfig | null;
  galleryImages: OnboardingGalleryImage[];
  locations: OnboardingLocation[];
  nextStep: 'business' | 'theme' | 'payment' | 'social' | 'done';
}

export interface OnboardingTheme {
  id: string;
  name: string;
  category: string;
  previewImageUrl: string | null;
}

async function onboardingFetch<T>(path: string, accessToken: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    const message =
      errorBody && typeof errorBody === 'object' && 'message' in errorBody
        ? String((errorBody as { message: unknown }).message)
        : response.statusText;
    throw new ApiError(response.status, message);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export function getOnboardingStatus(accessToken: string) {
  return onboardingFetch<OnboardingStatus>('/onboarding/status', accessToken, 'GET');
}

export function saveBusinessInfo(
  accessToken: string,
  data: {
    businessName: string;
    tagline?: string;
    logoUrl?: string;
    backgroundImageUrl?: string;
    description?: string;
    address?: string;
    hours?: string;
    phone?: string;
    agencySlug?: string;
  },
) {
  return onboardingFetch<OnboardingStatus>('/onboarding/business-info', accessToken, 'POST', data);
}

export function draftBusinessCopy(accessToken: string, businessName: string, category?: string) {
  return onboardingFetch<{ tagline: string; description: string } | null>('/onboarding/ai-draft', accessToken, 'POST', {
    businessName,
    category,
  });
}

export function selectTheme(accessToken: string, themeId: string, accentColor?: string | null) {
  return onboardingFetch('/onboarding/theme', accessToken, 'PATCH', { themeId, accentColor });
}

export function savePaymentMethods(
  accessToken: string,
  methods: { type: PaymentMethodType; qrImageUrl?: string; upiId?: string }[],
) {
  return onboardingFetch('/onboarding/payment-methods', accessToken, 'POST', { methods });
}

export function saveSocialAndReview(
  accessToken: string,
  data: {
    socialLinks: { platform: SocialPlatform; value: string }[];
    reviewLink?: string;
    sheetId?: string;
    sheetRange?: string;
    googlePlaceId?: string;
  },
) {
  return onboardingFetch<OnboardingStatus>('/onboarding/social-review', accessToken, 'POST', data);
}

export function saveMenuSection(accessToken: string, data: { heading?: string; fileUrl?: string }) {
  return onboardingFetch<{ menu: { heading: string; fileUrl: string } }>('/onboarding/menu', accessToken, 'POST', data);
}

export function addGalleryImage(accessToken: string, imageUrl: string) {
  return onboardingFetch<OnboardingGalleryImage>('/onboarding/gallery', accessToken, 'POST', { imageUrl });
}

export function removeGalleryImage(accessToken: string, id: string) {
  return onboardingFetch<void>(`/onboarding/gallery/${id}`, accessToken, 'DELETE');
}

export function saveContactSection(accessToken: string, data: { heading?: string; bookingUrl?: string }) {
  return onboardingFetch<{ contact: { heading?: string; bookingUrl?: string } }>('/onboarding/contact', accessToken, 'POST', data);
}

export function addLocation(
  accessToken: string,
  data: { name: string; address: string; phone?: string; hours?: string },
) {
  return onboardingFetch<OnboardingLocation>('/onboarding/locations', accessToken, 'POST', data);
}

export function updateLocation(
  accessToken: string,
  id: string,
  data: { name?: string; address?: string; phone?: string; hours?: string },
) {
  return onboardingFetch<OnboardingLocation>(`/onboarding/locations/${id}`, accessToken, 'PATCH', data);
}

export function removeLocation(accessToken: string, id: string) {
  return onboardingFetch<void>(`/onboarding/locations/${id}`, accessToken, 'DELETE');
}

export function completeOnboarding(accessToken: string) {
  return onboardingFetch<{ landingUrl: string; qrImageUrl: string | null }>('/onboarding/complete', accessToken, 'POST');
}

export function listThemes(accessToken: string) {
  return onboardingFetch<OnboardingTheme[]>('/themes', accessToken, 'GET');
}

export async function uploadImage(accessToken: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/uploads/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    const message =
      errorBody && typeof errorBody === 'object' && 'message' in errorBody
        ? String((errorBody as { message: unknown }).message)
        : response.statusText;
    throw new ApiError(response.status, message);
  }

  const { url } = (await response.json()) as { url: string };
  return url;
}

export async function uploadDocument(accessToken: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/uploads/document`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    const message =
      errorBody && typeof errorBody === 'object' && 'message' in errorBody
        ? String((errorBody as { message: unknown }).message)
        : response.statusText;
    throw new ApiError(response.status, message);
  }

  const { url } = (await response.json()) as { url: string };
  return url;
}

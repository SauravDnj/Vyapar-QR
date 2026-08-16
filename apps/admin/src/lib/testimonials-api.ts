import { apiFetch } from './api-client';

export interface Testimonial {
  id: string;
  authorName: string;
  quote: string;
  rating: number | null;
  isApproved: boolean;
  displayOrder: number;
  createdAt: string;
}

export function listTestimonials(accessToken: string) {
  return apiFetch<Testimonial[]>('/testimonials', { accessToken });
}

export function updateTestimonial(accessToken: string, id: string, data: { isApproved?: boolean; displayOrder?: number }) {
  return apiFetch<Testimonial>(`/testimonials/${id}`, { method: 'PATCH', accessToken, body: data });
}

export function deleteTestimonial(accessToken: string, id: string) {
  return apiFetch<void>(`/testimonials/${id}`, { method: 'DELETE', accessToken });
}

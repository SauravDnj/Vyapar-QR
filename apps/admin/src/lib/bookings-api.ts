import { apiFetch } from './api-client';

export interface BookingSlot {
  id: string;
  startsAt: string;
  durationMinutes: number;
  isBooked: boolean;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
}

export function listBookingSlots(accessToken: string) {
  return apiFetch<BookingSlot[]>('/bookings/slots', { accessToken });
}

export function createBookingSlot(accessToken: string, data: { startsAt: string; durationMinutes?: number }) {
  return apiFetch<BookingSlot>('/bookings/slots', { method: 'POST', accessToken, body: data });
}

export function createBulkBookingSlots(
  accessToken: string,
  data: { date: string; startTime: string; endTime: string; intervalMinutes: number },
) {
  return apiFetch<BookingSlot[]>('/bookings/slots/bulk', { method: 'POST', accessToken, body: data });
}

export function deleteBookingSlot(accessToken: string, id: string) {
  return apiFetch<void>(`/bookings/slots/${id}`, { method: 'DELETE', accessToken });
}

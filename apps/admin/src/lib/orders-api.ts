import { ApiError, apiFetch } from './api-client';

export type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled';

export interface OrderItem {
  menuItemId: string;
  name: string;
  unitPrice: string;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  itemsJson: OrderItem[];
  totalAmount: string;
  status: OrderStatus;
  notes: string | null;
  createdAt: string;
}

export interface PaginatedOrders {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export function listOrders(accessToken: string, params: { status?: OrderStatus; search?: string; page?: number } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  const qs = query.toString();
  return apiFetch<PaginatedOrders>(`/orders${qs ? `?${qs}` : ''}`, { accessToken });
}

export function updateOrderStatus(accessToken: string, id: string, status: OrderStatus) {
  return apiFetch<Order>(`/orders/${id}/status`, { method: 'PATCH', body: { status }, accessToken });
}

export function sendOrderWhatsapp(accessToken: string, id: string, message: string) {
  return apiFetch<{ sent: boolean }>(`/orders/${id}/whatsapp`, { method: 'POST', body: { message }, accessToken });
}

export { ApiError };

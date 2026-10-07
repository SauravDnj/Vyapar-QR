import { ApiError, apiFetch } from './api-client';

export type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled';

export interface OrderItem {
  menuItemId: string;
  name: string;
  unitPrice: string;
  quantity: number;
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  itemsJson: OrderItem[];
  totalAmount: string;
  status: OrderStatus;
  notes: string | null;
  createdAt: string;
  /** Null on orders placed before these existed. */
  orderNumber: number | null;
  orderType: OrderType | null;
  tableNumber: string | null;
  deliveryAddress: string | null;
}

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

/** "Dine-in · Table 5", "Takeaway", "Delivery" — or null for an old order. */
export function describeOrderType(order: Pick<Order, 'orderType' | 'tableNumber'>): string | null {
  if (!order.orderType) return null;
  const label = ORDER_TYPE_LABEL[order.orderType];
  return order.orderType === 'dine_in' && order.tableNumber ? `${label} · Table ${order.tableNumber}` : label;
}

export interface LiveOrders {
  pendingCount: number;
  newOrders: Order[];
  serverTime: string;
}

export interface PaginatedOrders {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export function listOrders(
  accessToken: string,
  params: { status?: OrderStatus; search?: string; page?: number; pageSize?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
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

/** `since` is the `serverTime` of the previous call: the API's clock, not
 * this browser's, so a phone with the wrong time can't miss orders. */
export function getLiveOrders(accessToken: string, since: string | null) {
  return apiFetch<LiveOrders>(`/orders/live${since ? `?since=${encodeURIComponent(since)}` : ''}`, { accessToken });
}

export { ApiError };

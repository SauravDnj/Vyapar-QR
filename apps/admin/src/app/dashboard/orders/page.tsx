'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge, type BadgeTone } from '../../../components/ui/badge';
import { Drawer } from '../../../components/ui/drawer';
import { useAuth } from '../../../context/auth-context';
import { ApiError, listOrders, sendOrderWhatsapp, updateOrderStatus, type Order, type OrderStatus } from '../../../lib/orders-api';

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending: 'info',
  confirmed: 'warning',
  ready: 'neutral',
  completed: 'success',
  cancelled: 'danger',
};

function OrderDrawer({
  order,
  isOpen,
  onClose,
  onStatusChange,
  onSendWhatsapp,
}: {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: OrderStatus) => Promise<void>;
  onSendWhatsapp: (id: string, message: string) => Promise<void>;
}) {
  const [displayOrder, setDisplayOrder] = useState(order);
  const [status, setStatus] = useState<OrderStatus>(order?.status ?? 'pending');
  const [isSaving, setIsSaving] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);

  if (order && order !== displayOrder) {
    setDisplayOrder(order);
    setStatus(order.status);
    setWhatsappMessage('');
  }

  async function handleStatusChange(next: OrderStatus) {
    if (!order) return;
    setStatus(next);
    setIsSaving(true);
    try {
      await onStatusChange(order.id, next);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendWhatsapp() {
    if (!order || !whatsappMessage.trim()) return;
    setIsSendingWhatsapp(true);
    try {
      await onSendWhatsapp(order.id, whatsappMessage.trim());
      setWhatsappMessage('');
    } finally {
      setIsSendingWhatsapp(false);
    }
  }

  if (!displayOrder) {
    return <Drawer isOpen={isOpen} onClose={onClose}>{null}</Drawer>;
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold">{displayOrder.customerName}</p>
          <p className="font-mono text-sm text-muted">{displayOrder.customerPhone}</p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close drawer">
          ✕
        </button>
      </div>

      <Badge tone={STATUS_TONE[displayOrder.status]}>{STATUS_LABEL[displayOrder.status]}</Badge>

      <p className="font-mono text-xs text-muted">Placed {new Date(displayOrder.createdAt).toLocaleString()}</p>

      <div className="flex flex-col gap-1 rounded-md border border-border-color p-3 text-sm">
        {displayOrder.itemsJson.map((item) => (
          <div key={item.menuItemId} className="flex justify-between">
            <span>
              {item.quantity}× {item.name}
            </span>
            <span className="font-mono">₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border-color pt-1 font-medium">
          <span>Total</span>
          <span className="font-mono">₹{displayOrder.totalAmount}</span>
        </div>
      </div>

      {displayOrder.notes && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">Notes</p>
          <p className="text-muted">{displayOrder.notes}</p>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Status
        <select
          value={status}
          onChange={(event) => void handleStatusChange(event.target.value as OrderStatus)}
          disabled={isSaving}
          className="rounded-md border border-border-color px-3 py-2"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABEL[option]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2 border-t border-border-color pt-4">
        <p className="text-sm font-medium">WhatsApp customer</p>
        <div className="flex gap-2">
          <input
            value={whatsappMessage}
            onChange={(event) => setWhatsappMessage(event.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-md border border-border-color px-3 py-2 text-sm"
          />
          <button
            disabled={isSendingWhatsapp || !whatsappMessage.trim()}
            onClick={() => void handleSendWhatsapp()}
            className="rounded-md border border-border-color px-3 py-2 text-sm disabled:opacity-50"
          >
            {isSendingWhatsapp ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}

type ViewMode = 'list' | 'board';

function OrdersBoard({
  orders,
  onStatusChange,
  onSelect,
}: {
  orders: Order[];
  onStatusChange: (order: Order, status: OrderStatus) => void;
  onSelect: (order: Order) => void;
}) {
  const [dragOverColumn, setDragOverColumn] = useState<OrderStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function handleDrop(event: React.DragEvent<HTMLDivElement>, status: OrderStatus) {
    event.preventDefault();
    setDragOverColumn(null);
    const orderId = event.dataTransfer.getData('text/plain');
    const order = orders.find((entry) => entry.id === orderId);
    if (order && order.status !== status) {
      onStatusChange(order, status);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {STATUS_OPTIONS.map((status) => {
        const columnOrders = orders.filter((order) => order.status === status);
        const isDragOver = dragOverColumn === status;
        return (
          <div
            key={status}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverColumn(status);
            }}
            onDragLeave={() => setDragOverColumn((prev) => (prev === status ? null : prev))}
            onDrop={(event) => handleDrop(event, status)}
            className={`flex min-h-48 flex-col gap-2 rounded-lg border p-3 transition-colors ${
              isDragOver ? 'border-accent bg-accent/5' : 'border-border-color bg-surface'
            }`}
          >
            <div className="flex items-center justify-between px-1">
              <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
              <span className="font-mono text-xs text-muted">{columnOrders.length}</span>
            </div>
            {columnOrders.map((order) => (
              <div
                key={order.id}
                draggable
                onDragStart={(event) => {
                  setDraggingId(order.id);
                  event.dataTransfer.setData('text/plain', order.id);
                }}
                onDragEnd={() => setDraggingId(null)}
                onClick={() => onSelect(order)}
                className={`flex cursor-grab flex-col gap-1.5 rounded-md border border-border-color bg-background p-3 text-sm shadow-sm transition-all duration-150 hover:-translate-y-0.5 active:cursor-grabbing ${
                  draggingId === order.id ? 'opacity-40' : 'opacity-100'
                }`}
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <p className="font-medium">{order.customerName}</p>
                <p className="font-mono text-xs text-muted">₹{order.totalAmount}</p>
              </div>
            ))}
            {columnOrders.length === 0 && <p className="px-1 text-xs text-muted">No orders</p>}
          </div>
        );
      })}
    </div>
  );
}

function OrdersContent() {
  const { accessToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('board');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLocked(false);
    try {
      const result = await listOrders(accessToken, { status: statusFilter || undefined, search: search || undefined });
      setOrders(result.data);
      setTotal(result.total);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setLocked(true);
      } else {
        setMessage('Failed to load orders.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, statusFilter, search]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleStatusChange(id: string, status: OrderStatus) {
    if (!accessToken) return;
    try {
      const updated = await updateOrderStatus(accessToken, id, status);
      setOrders((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to update order.');
    }
  }

  async function handleSendWhatsapp(id: string, whatsappMessage: string) {
    if (!accessToken) return;
    try {
      const result = await sendOrderWhatsapp(accessToken, id, whatsappMessage);
      setMessage(result.sent ? null : 'WhatsApp is not configured on this deployment yet.');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to send WhatsApp message.');
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Orders</h1>
      {message && <p className="text-sm text-danger">{message}</p>}

      {locked ? (
        <div className="w-fit max-w-md rounded-md border border-warning bg-warning-bg p-4 text-sm text-warning">
          <p className="font-medium">Digital menu + ordering is a plan feature.</p>
          <p className="mt-1">
            Upgrade your plan from{' '}
            <a href="/dashboard/billing" className="underline">
              Billing
            </a>{' '}
            to start receiving orders from your menu.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-md border border-border-color font-mono text-sm">
              <button
                onClick={() => setStatusFilter('')}
                className={`px-3 py-1.5 ${statusFilter === '' ? 'bg-accent text-accent-foreground' : ''}`}
              >
                All
              </button>
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`border-l border-border-color px-3 py-1.5 ${statusFilter === status ? 'bg-accent text-accent-foreground' : ''}`}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or phone"
              className="rounded-md border border-border-color px-3 py-1.5 text-sm"
            />
            <div className="flex overflow-hidden rounded-md border border-border-color font-mono text-sm">
              <button onClick={() => setView('list')} className={`px-3 py-1.5 ${view === 'list' ? 'bg-accent text-accent-foreground' : ''}`}>
                List
              </button>
              <button
                onClick={() => setView('board')}
                className={`border-l border-border-color px-3 py-1.5 ${view === 'board' ? 'bg-accent text-accent-foreground' : ''}`}
              >
                Board
              </button>
            </div>
            <p className="text-sm text-muted">{total} total</p>
          </div>

          {isLoading ? (
            <p>Loading…</p>
          ) : orders.length === 0 ? (
            <p className="text-muted">No orders yet.</p>
          ) : view === 'board' ? (
            <OrdersBoard orders={orders} onStatusChange={(order, status) => void handleStatusChange(order.id, status)} onSelect={setSelectedOrder} />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border-color bg-surface" style={{ boxShadow: 'var(--shadow-card)' }}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-color font-mono text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="cursor-pointer border-b border-border-color last:border-0 hover:bg-border-color/20"
                    >
                      <td className="px-4 py-3 font-medium">{order.customerName}</td>
                      <td className="px-4 py-3 font-mono">{order.customerPhone}</td>
                      <td className="px-4 py-3 font-mono">₹{order.totalAmount}</td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">{new Date(order.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <OrderDrawer
        order={selectedOrder}
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        onStatusChange={handleStatusChange}
        onSendWhatsapp={handleSendWhatsapp}
      />
    </>
  );
}

export default function OrdersPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <OrdersContent />
    </ProtectedRoute>
  );
}

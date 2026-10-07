'use client';

import { useCallback, useEffect, useState } from 'react';

import { useOrderAlerts } from '../../../components/order-alerts';
import { ProtectedRoute } from '../../../components/protected-route';
import { Badge, type BadgeTone } from '../../../components/ui/badge';
import { Drawer } from '../../../components/ui/drawer';
import { useAuth } from '../../../context/auth-context';
import { getOnboardingStatus, saveMenuSection } from '../../../lib/onboarding-api';
import {
  ApiError,
  describeOrderType,
  listOrders,
  ORDER_TYPE_LABEL,
  updateOrderStatus,
  type Order,
  type OrderStatus,
  type OrderType,
} from '../../../lib/orders-api';

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];
/** Named for what the kitchen does, not the database value. */
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  confirmed: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending: 'info',
  confirmed: 'warning',
  ready: 'success',
  completed: 'neutral',
  cancelled: 'danger',
};
/** The one obvious next step for each live status. */
const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  pending: { status: 'confirmed', label: 'Accept' },
  confirmed: { status: 'ready', label: 'Mark ready' },
  ready: { status: 'completed', label: 'Complete' },
};
const BOARD_COLUMNS: OrderStatus[] = ['pending', 'confirmed', 'ready'];
const ALL_ORDER_TYPES: OrderType[] = ['dine_in', 'takeaway', 'delivery'];
const REFRESH_MS = 30_000;

function orderLabel(order: Order): string {
  return order.orderNumber ? `#${String(order.orderNumber)}` : 'Order';
}

function timeAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)} h ago`;
  return new Date(iso).toLocaleDateString();
}

/** wa.me wants the number with its country code and nothing else. A bare
 * 10-digit number is taken as Indian. */
function whatsappHref(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

function customerMessage(order: Order, businessName: string): string {
  const label = orderLabel(order);
  switch (order.status) {
    case 'pending':
    case 'confirmed':
      return `Hi ${order.customerName}, your order ${label} at ${businessName} is accepted and being prepared.`;
    case 'ready':
      return order.orderType === 'delivery'
        ? `Hi ${order.customerName}, your order ${label} from ${businessName} is out for delivery.`
        : `Hi ${order.customerName}, your order ${label} at ${businessName} is ready.`;
    default:
      return `Hi ${order.customerName}, about your order ${label} at ${businessName}: `;
  }
}

function OrderCard({
  order,
  now,
  onAdvance,
  onSelect,
  isUpdating,
  draggable,
  onDragStart,
}: {
  order: Order;
  now: number;
  onAdvance: (order: Order, status: OrderStatus) => void;
  onSelect: (order: Order) => void;
  isUpdating: boolean;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
}) {
  const next = NEXT_STEP[order.status];
  const type = describeOrderType(order);
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={`flex flex-col gap-2 rounded-md border bg-background p-3 text-sm ${
        order.status === 'pending' ? 'border-accent' : 'border-border-color'
      } ${isUpdating ? 'opacity-50' : ''}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <button type="button" onClick={() => onSelect(order)} className="flex flex-col gap-1 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base font-semibold">{orderLabel(order)}</span>
          <span className="font-mono text-xs text-muted">{timeAgo(order.createdAt, now)}</span>
        </div>
        {type ? <span className="w-fit rounded bg-border-color/50 px-1.5 py-0.5 text-xs font-medium">{type}</span> : null}
        <ul className="flex flex-col">
          {order.itemsJson.map((item) => (
            <li key={item.menuItemId}>
              <span className="font-medium">{item.quantity}×</span> {item.name}
            </li>
          ))}
        </ul>
        {order.notes ? <p className="rounded bg-warning-bg px-2 py-1 text-xs text-warning">📝 {order.notes}</p> : null}
        <div className="flex items-baseline justify-between gap-2 text-muted">
          <span className="truncate">{order.customerName}</span>
          <span className="font-mono font-medium text-foreground">₹{order.totalAmount}</span>
        </div>
      </button>
      {next ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onAdvance(order, next.status)}
            className="flex-1 rounded-md bg-accent px-3 py-2 font-medium text-accent-foreground disabled:opacity-50"
          >
            {next.label}
          </button>
          {order.status === 'pending' ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onAdvance(order, 'cancelled')}
              className="rounded-md border border-border-color px-3 py-2 text-danger disabled:opacity-50"
            >
              Decline
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OrderDrawer({
  order,
  isOpen,
  onClose,
  onStatusChange,
  businessName,
}: {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (order: Order, status: OrderStatus) => void;
  businessName: string;
}) {
  if (!order) {
    return <Drawer isOpen={isOpen} onClose={onClose}>{null}</Drawer>;
  }
  const type = describeOrderType(order);

  return (
    <Drawer isOpen={isOpen} onClose={onClose}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold">
            {orderLabel(order)} · {order.customerName}
          </p>
          <p className="font-mono text-sm text-muted">{order.customerPhone}</p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close drawer">
          ✕
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        {type ? <span className="rounded bg-border-color/50 px-2 py-0.5 text-xs font-medium">{type}</span> : null}
      </div>

      <p className="font-mono text-xs text-muted">Placed {new Date(order.createdAt).toLocaleString()}</p>

      {order.deliveryAddress ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">Deliver to</p>
          <p className="whitespace-pre-line text-muted">{order.deliveryAddress}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1 rounded-md border border-border-color p-3 text-sm">
        {order.itemsJson.map((item) => (
          <div key={item.menuItemId} className="flex justify-between">
            <span>
              {item.quantity}× {item.name}
            </span>
            <span className="font-mono">₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border-color pt-1 font-medium">
          <span>Total</span>
          <span className="font-mono">₹{order.totalAmount}</span>
        </div>
      </div>

      {order.notes ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">Customer note</p>
          <p className="text-muted">{order.notes}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">Status</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onStatusChange(order, option)}
              className={`rounded-md border px-3 py-1.5 ${
                order.status === option ? 'border-accent bg-accent text-accent-foreground' : 'border-border-color'
              }`}
            >
              {STATUS_LABEL[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border-color pt-4 text-sm">
        <a href={`tel:${order.customerPhone.replace(/\s+/g, '')}`} className="rounded-md border border-border-color px-3 py-2">
          📞 Call
        </a>
        <a
          href={whatsappHref(order.customerPhone, customerMessage(order, businessName))}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border-color px-3 py-2"
        >
          💬 WhatsApp customer
        </a>
      </div>
    </Drawer>
  );
}

/** Which order types the shop takes — what the customer can pick at checkout. */
function OrderTypeSettings() {
  const { accessToken } = useAuth();
  const [selected, setSelected] = useState<OrderType[] | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        const status = await getOnboardingStatus(accessToken);
        const saved = (status.landingPage?.contentJson.menu?.orderTypes ?? '')
          .split(',')
          .filter((entry): entry is OrderType => ALL_ORDER_TYPES.includes(entry as OrderType));
        setSelected(saved.length > 0 ? saved : ['dine_in', 'takeaway']);
      } catch {
        setSelected(['dine_in', 'takeaway']);
      }
    })();
  }, [accessToken]);

  async function toggle(type: OrderType) {
    if (!accessToken || !selected) return;
    const next = selected.includes(type) ? selected.filter((entry) => entry !== type) : [...selected, type];
    if (next.length === 0) return; // at least one way to order
    const ordered = ALL_ORDER_TYPES.filter((entry) => next.includes(entry));
    setSelected(ordered);
    setState('saving');
    try {
      await saveMenuSection(accessToken, { orderTypes: ordered.join(',') });
      setState('saved');
    } catch {
      setState('error');
    }
  }

  if (!selected) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-color bg-surface px-4 py-3 text-sm">
      <span className="font-medium">Customers can order for:</span>
      {ALL_ORDER_TYPES.map((type) => (
        <label key={type} className="flex items-center gap-1.5">
          <input type="checkbox" checked={selected.includes(type)} onChange={() => void toggle(type)} />
          {ORDER_TYPE_LABEL[type]}
        </label>
      ))}
      <span className="text-xs text-muted">
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved — live on your page' : state === 'error' ? 'Couldn’t save' : ''}
      </span>
    </div>
  );
}

type ViewMode = 'board' | 'list';

function OrdersContent() {
  const { accessToken, user } = useAuth();
  const { version } = useOrderAlerts();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('board');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [businessName, setBusinessName] = useState('our shop');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<OrderStatus | null>(null);

  const refresh = useCallback(
    async (quiet = false) => {
      if (!accessToken) return;
      if (!quiet) setIsLoading(true);
      try {
        const result = await listOrders(accessToken, {
          status: view === 'list' ? statusFilter || undefined : undefined,
          search: search || undefined,
          pageSize: 100,
        });
        setOrders(result.data);
        setTotal(result.total);
        setLocked(false);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          setLocked(true);
        } else if (!quiet) {
          setMessage('Failed to load orders.');
        }
      } finally {
        if (!quiet) setIsLoading(false);
      }
    },
    [accessToken, statusFilter, search, view],
  );

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  // New orders arrive through the dashboard-wide alert; other staff moving
  // orders along show up on the slower refresh.
  useEffect(() => {
    if (version === 0) return;
    void (async () => {
      await refresh(true);
    })();
  }, [version, refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      void refresh(true);
    }, REFRESH_MS);
    return () => {
      clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (!accessToken) return;
    void getOnboardingStatus(accessToken)
      .then((status) => {
        if (status.client?.businessName) setBusinessName(status.client.businessName);
      })
      .catch(() => undefined);
  }, [accessToken]);

  async function handleStatusChange(order: Order, status: OrderStatus) {
    if (!accessToken || order.status === status) return;
    setUpdatingId(order.id);
    // Move it straight away; put it back if the save fails.
    setOrders((previous) => previous.map((entry) => (entry.id === order.id ? { ...entry, status } : entry)));
    try {
      const updated = await updateOrderStatus(accessToken, order.id, status);
      setOrders((previous) => previous.map((entry) => (entry.id === order.id ? updated : entry)));
      setMessage(null);
    } catch (error) {
      setOrders((previous) => previous.map((entry) => (entry.id === order.id ? order : entry)));
      setMessage(error instanceof ApiError ? error.message : 'Failed to update order.');
    } finally {
      setUpdatingId(null);
    }
  }

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;
  const finished = orders.filter((order) => order.status === 'completed' || order.status === 'cancelled').slice(0, 12);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Orders</h1>
        {!locked ? (
          <div className="flex overflow-hidden rounded-md border border-border-color font-mono text-sm">
            <button onClick={() => setView('board')} className={`px-3 py-1.5 ${view === 'board' ? 'bg-accent text-accent-foreground' : ''}`}>
              Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`border-l border-border-color px-3 py-1.5 ${view === 'list' ? 'bg-accent text-accent-foreground' : ''}`}
            >
              All orders
            </button>
          </div>
        ) : null}
      </div>
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
          {user?.role === 'client_admin' ? <OrderTypeSettings /> : null}

          {view === 'list' ? (
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
              <p className="text-sm text-muted">{total} total</p>
            </div>
          ) : null}

          {isLoading ? (
            <p>Loading…</p>
          ) : orders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border-color p-8 text-center text-sm text-muted">
              <p className="font-medium text-foreground">No orders yet.</p>
              <p className="mt-1">Orders from your menu appear here, and the dashboard chimes when one arrives.</p>
            </div>
          ) : view === 'board' ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {BOARD_COLUMNS.map((status) => {
                  const columnOrders = orders
                    .filter((order) => order.status === status)
                    // Oldest first: the order that has waited longest is next.
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                  return (
                    <div
                      key={status}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOver(status);
                      }}
                      onDragLeave={() => setDragOver((previous) => (previous === status ? null : previous))}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragOver(null);
                        const order = orders.find((entry) => entry.id === event.dataTransfer.getData('text/plain'));
                        if (order) void handleStatusChange(order, status);
                      }}
                      className={`flex min-h-48 flex-col gap-3 rounded-lg border p-3 transition-colors ${
                        dragOver === status ? 'border-accent bg-accent/5' : 'border-border-color bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between px-1">
                        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                        <span className="font-mono text-xs text-muted">{columnOrders.length}</span>
                      </div>
                      {columnOrders.map((order) => (
                        <div key={order.id} className={draggingId === order.id ? 'opacity-40' : ''} onDragEnd={() => setDraggingId(null)}>
                          <OrderCard
                            order={order}
                            now={now}
                            onAdvance={(entry, next) => void handleStatusChange(entry, next)}
                            onSelect={(entry) => setSelectedId(entry.id)}
                            isUpdating={updatingId === order.id}
                            draggable
                            onDragStart={(event) => {
                              setDraggingId(order.id);
                              event.dataTransfer.setData('text/plain', order.id);
                            }}
                          />
                        </div>
                      ))}
                      {columnOrders.length === 0 ? <p className="px-1 text-xs text-muted">Nothing here</p> : null}
                    </div>
                  );
                })}
              </div>

              {finished.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted">Recently finished</p>
                  <div className="flex flex-col divide-y divide-border-color rounded-lg border border-border-color bg-surface text-sm">
                    {finished.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setSelectedId(order.id)}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-border-color/20"
                      >
                        <span className="font-medium">
                          {orderLabel(order)} · {order.customerName}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="font-mono">₹{order.totalAmount}</span>
                          <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border-color bg-surface" style={{ boxShadow: 'var(--shadow-card)' }}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-color font-mono text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className="cursor-pointer border-b border-border-color last:border-0 hover:bg-border-color/20"
                    >
                      <td className="px-4 py-3 font-medium">{orderLabel(order)}</td>
                      <td className="px-4 py-3">
                        {order.customerName}
                        <span className="block font-mono text-xs text-muted">{order.customerPhone}</span>
                      </td>
                      <td className="px-4 py-3">{describeOrderType(order) ?? '—'}</td>
                      <td className="px-4 py-3 font-mono">₹{order.totalAmount}</td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">{new Date(order.createdAt).toLocaleString()}</td>
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
        onClose={() => setSelectedId(null)}
        onStatusChange={(order, status) => void handleStatusChange(order, status)}
        businessName={businessName}
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

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from './icon';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  priceRupees: string;
  imageUrl: string | null;
}

interface PublicMenuCategory {
  id: string;
  name: string;
  items: PublicMenuItem[];
}

type OrderType = 'dine_in' | 'takeaway' | 'delivery';
type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled';

interface PlacedOrder {
  id: string;
  orderNumber: number;
  totalAmount: string;
  orderType: OrderType;
  placedAt: number;
}

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

/** What the customer sees while they wait. "Ready" depends on how they're
 * getting the food: nobody collects a dine-in order from the counter. */
function statusText(status: OrderStatus, type: OrderType): { title: string; detail: string } {
  switch (status) {
    case 'pending':
      return { title: 'Order sent', detail: 'Waiting for the shop to accept it.' };
    case 'confirmed':
      return { title: 'Accepted', detail: 'Your order is being prepared.' };
    case 'ready':
      return {
        title: 'Ready',
        detail:
          type === 'dine_in' ? 'It’s on its way to your table.' : type === 'delivery' ? 'It’s out for delivery.' : 'Collect it from the counter.',
      };
    case 'completed':
      return { title: 'Completed', detail: 'Thank you — enjoy!' };
    case 'cancelled':
      return { title: 'Cancelled', detail: 'The shop couldn’t take this order. Please ask them directly.' };
  }
}

const STEPS: OrderStatus[] = ['pending', 'confirmed', 'ready', 'completed'];

/** An order older than this is history, not something to keep tracking when
 * the customer opens the menu again. */
const TRACK_FOR_MS = 6 * 60 * 60 * 1000;
const STATUS_POLL_MS = 8000;

function formatRupees(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function digitCount(phone: string): number {
  return phone.replace(/\D/g, '').length;
}

/** Storage can be missing or throw (private mode, blocked site data); the
 * order flow must work regardless, just without remembering anything. */
function readStored(storage: 'local' | 'session', key: string): unknown {
  try {
    const raw = (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeStored(storage: 'local' | 'session', key: string, value: unknown): void {
  try {
    const target = storage === 'local' ? window.localStorage : window.sessionStorage;
    if (value === null) target.removeItem(key);
    else target.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort only.
  }
}

/** The accepted order types from the owner's setting; dine-in and takeaway
 * when they haven't chosen. */
export function parseOrderTypes(value: string | undefined): OrderType[] {
  const chosen = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is OrderType => entry === 'dine_in' || entry === 'takeaway' || entry === 'delivery');
  return chosen.length > 0 ? chosen : ['dine_in', 'takeaway'];
}

type Step = 'browse' | 'checkout' | 'placed';

/**
 * Order from the menu, inside the theme's bottom sheet.
 *
 * Self-fetching, like `CouponsList`/`ReviewFunnel` — the menu isn't part of
 * the landing-page payload, and availability and prices have to be live
 * rather than sit in the page's cache. Built for one thumb on a phone: an Add
 * button on every dish, a cart bar that never scrolls away, and after
 * ordering a live status instead of "they'll be in touch".
 */
export function MenuOrder({ slug, orderTypes }: { slug?: string; orderTypes?: string }) {
  const types = useMemo(() => parseOrderTypes(orderTypes), [orderTypes]);
  const [categories, setCategories] = useState<PublicMenuCategory[] | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>('browse');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [orderType, setOrderType] = useState<OrderType>(types[0] ?? 'takeaway');
  const [tableNumber, setTableNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — must stay hidden from real users
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [status, setStatus] = useState<OrderStatus>('pending');

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const cartKey = `vq-cart:${slug ?? ''}`;
  const orderKey = `vq-order:${slug ?? ''}`;

  // Restore what this phone already knows: the cart (this visit), the
  // customer's details (every visit) and an order still being tracked.
  useEffect(() => {
    if (!slug) return;
    const savedCart = readStored('session', cartKey) as Record<string, number> | null;
    const savedCustomer = readStored('local', 'vq-customer') as { name?: string; phone?: string; address?: string } | null;
    const savedOrder = readStored('local', orderKey) as PlacedOrder | null;
    if (savedCart) setCart(savedCart);
    if (savedCustomer?.name) setCustomerName(savedCustomer.name);
    if (savedCustomer?.phone) setCustomerPhone(savedCustomer.phone);
    if (savedCustomer?.address) setDeliveryAddress(savedCustomer.address);
    if (savedOrder && Date.now() - savedOrder.placedAt < TRACK_FOR_MS) {
      setPlaced(savedOrder);
      setStep('placed');
    }
  }, [slug, cartKey, orderKey]);

  useEffect(() => {
    if (!slug) return;
    const request = { cancelled: false };
    void (async () => {
      try {
        const response = await fetch(`${API_URL}/public/landing/${slug}/menu`);
        const data = response.ok ? ((await response.json()) as PublicMenuCategory[]) : [];
        if (!request.cancelled) {
          setCategories(data);
          setActiveCategory(data[0]?.id ?? null);
        }
      } catch {
        if (!request.cancelled) setCategories([]);
      }
    })();
    return () => {
      request.cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (slug) writeStored('session', cartKey, cart);
  }, [slug, cartKey, cart]);

  // Live status while an order is open. Stops once it can't change again.
  const pollStatus = useCallback(async () => {
    if (!slug || !placed) return null;
    try {
      const response = await fetch(`${API_URL}/public/landing/${slug}/orders/${placed.id}`);
      if (!response.ok) return null;
      const data = (await response.json()) as { status: OrderStatus };
      setStatus(data.status);
      return data.status;
    } catch {
      return null;
    }
  }, [slug, placed]);

  useEffect(() => {
    if (step !== 'placed' || !placed) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      const latest = await pollStatus();
      if (stopped || latest === 'completed' || latest === 'cancelled') return;
      timer = setTimeout(() => void tick(), STATUS_POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [step, placed, pollStatus]);

  const items = useMemo(() => (categories ?? []).flatMap((category) => category.items), [categories]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  // Only items still on the menu count — a dish removed since the cart was
  // saved silently drops out instead of failing the order.
  const cartLines = Object.entries(cart).flatMap(([id, quantity]) => {
    const item = itemsById.get(id);
    return item && quantity > 0 ? [{ item, quantity }] : [];
  });
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cartLines.reduce((sum, line) => sum + Number(line.item.priceRupees) * line.quantity, 0);

  if (!slug) {
    return null;
  }
  const clientSlug: string = slug;

  if (categories === null && step !== 'placed') {
    return (
      <div className="flex flex-col gap-3 py-2" aria-busy="true" aria-label="Loading menu">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-20 animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--t-text)_6%,transparent)]" />
        ))}
      </div>
    );
  }

  if (step !== 'placed' && (categories ?? []).length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--t-muted)]">The menu isn’t available right now.</p>;
  }

  function setQuantity(itemId: string, quantity: number) {
    setCart((current) => ({ ...current, [itemId]: Math.max(0, Math.min(50, quantity)) }));
  }

  function jumpTo(categoryId: string) {
    setActiveCategory(categoryId);
    sectionRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const nameMissing = customerName.trim().length === 0;
  const phoneInvalid = digitCount(customerPhone) < 10;
  const addressMissing = orderType === 'delivery' && deliveryAddress.trim().length === 0;

  async function handlePlaceOrder() {
    if (cartLines.length === 0) return;
    if (nameMissing || phoneInvalid || addressMissing) {
      setShowErrors(true);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/public/landing/${clientSlug}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          items: cartLines.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity })),
          orderType,
          tableNumber: orderType === 'dine_in' ? tableNumber.trim() || undefined : undefined,
          deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
          notes: notes.trim() || undefined,
          website: website || undefined,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
        throw new Error(response.status === 429 ? 'Too many orders from this phone. Wait a minute and try again.' : (message ?? ''));
      }
      const result = (await response.json()) as { id: string; orderNumber: number; totalAmount: string };
      const order: PlacedOrder = { ...result, orderType, placedAt: Date.now() };
      writeStored('local', orderKey, order);
      writeStored('local', 'vq-customer', {
        name: customerName.trim(),
        phone: customerPhone.trim(),
        address: deliveryAddress.trim() || undefined,
      });
      setCart({});
      setNotes('');
      setStatus('pending');
      setPlaced(order);
      setStep('placed');
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'Couldn’t send your order. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function orderAgain() {
    writeStored('local', orderKey, null);
    setPlaced(null);
    setShowErrors(false);
    setStep('browse');
  }

  /* ---------------------------------------------------------------- placed */
  if (step === 'placed' && placed) {
    const text = statusText(status, placed.orderType);
    const reached = STEPS.indexOf(status);
    return (
      <div className="flex flex-col items-center gap-5 pt-2 pb-4 text-center" aria-live="polite">
        <span
          className={`flex size-16 items-center justify-center rounded-full ${
            status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-[var(--t-accent)] text-[var(--t-accent-text)]'
          }`}
        >
          <Icon name={status === 'cancelled' ? 'close' : 'check'} className="size-8" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-[var(--t-muted)]">
            {ORDER_TYPE_LABEL[placed.orderType]} · {formatRupees(Number(placed.totalAmount))}
          </p>
          <p className="text-3xl font-bold tracking-tight">Order #{placed.orderNumber}</p>
          <p className="text-lg font-semibold">{text.title}</p>
          <p className="text-sm text-[var(--t-muted)]">{text.detail}</p>
        </div>

        {status !== 'cancelled' ? (
          <ol className="flex w-full max-w-xs items-center" aria-label="Order progress">
            {STEPS.map((entry, index) => (
              <li key={entry} className="flex flex-1 items-center last:flex-none">
                <span
                  className={`size-3 shrink-0 rounded-full ${
                    index <= reached ? 'bg-[var(--t-accent)]' : 'bg-[color-mix(in_srgb,var(--t-text)_15%,transparent)]'
                  }`}
                  aria-label={entry}
                />
                {index < STEPS.length - 1 ? (
                  <span
                    className={`h-0.5 flex-1 ${
                      index < reached ? 'bg-[var(--t-accent)]' : 'bg-[color-mix(in_srgb,var(--t-text)_15%,transparent)]'
                    }`}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}

        <p className="text-xs text-[var(--t-muted)]">Keep this screen open — it updates by itself.</p>
        <button
          type="button"
          onClick={orderAgain}
          className="rounded-full border border-[var(--t-border)] px-5 py-2.5 text-sm font-medium active:scale-95"
        >
          Order something else
        </button>
      </div>
    );
  }

  /* -------------------------------------------------------------- checkout */
  if (step === 'checkout') {
    const fieldClass =
      'w-full rounded-xl border bg-transparent px-3.5 py-3 text-[15px] outline-none focus:border-[var(--t-accent)]';
    return (
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => {
            setStep('browse');
          }}
          className="flex w-fit items-center gap-1 text-sm font-medium text-[var(--t-muted)]"
        >
          <Icon name="chevron-left" className="size-4" />
          Back to menu
        </button>

        <section className="flex flex-col divide-y divide-[var(--t-border)] rounded-2xl border border-[var(--t-border)]">
          {cartLines.map(({ item, quantity }) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">{item.name}</p>
                <p className="text-sm text-[var(--t-muted)]">{formatRupees(Number(item.priceRupees) * quantity)}</p>
              </div>
              <Stepper
                name={item.name}
                quantity={quantity}
                onChange={(next) => {
                  setQuantity(item.id, next);
                }}
              />
            </div>
          ))}
          <div className="flex items-center justify-between px-3.5 py-3 font-semibold">
            <span>Total</span>
            <span>{formatRupees(subtotal)}</span>
          </div>
        </section>

        {cartLines.length === 0 ? (
          <p className="text-center text-sm text-[var(--t-muted)]">Your cart is empty.</p>
        ) : null}

        {types.length > 1 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">How would you like it?</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${String(types.length)}, minmax(0, 1fr))` }}>
              {types.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={orderType === type}
                  onClick={() => {
                    setOrderType(type);
                  }}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors ${
                    orderType === type
                      ? 'border-[var(--t-accent)] bg-[var(--t-accent)] text-[var(--t-accent-text)]'
                      : 'border-[var(--t-border)]'
                  }`}
                >
                  {ORDER_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {orderType === 'dine_in' ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Table number <span className="sr-only">(optional)</span>
              <input
                inputMode="numeric"
                placeholder="e.g. 5 (optional)"
                value={tableNumber}
                maxLength={20}
                onChange={(event) => {
                  setTableNumber(event.target.value);
                }}
                className={`${fieldClass} border-[var(--t-border)]`}
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Your name
            <input
              autoComplete="name"
              value={customerName}
              maxLength={200}
              onChange={(event) => {
                setCustomerName(event.target.value);
              }}
              aria-invalid={showErrors && nameMissing}
              className={`${fieldClass} ${showErrors && nameMissing ? 'border-red-500' : 'border-[var(--t-border)]'}`}
            />
            {showErrors && nameMissing ? <span className="text-xs font-normal text-red-600">Enter your name.</span> : null}
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Phone number
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              value={customerPhone}
              maxLength={20}
              onChange={(event) => {
                setCustomerPhone(event.target.value);
              }}
              aria-invalid={showErrors && phoneInvalid}
              className={`${fieldClass} ${showErrors && phoneInvalid ? 'border-red-500' : 'border-[var(--t-border)]'}`}
            />
            {showErrors && phoneInvalid ? (
              <span className="text-xs font-normal text-red-600">Enter a 10-digit phone number so the shop can reach you.</span>
            ) : null}
          </label>
          {orderType === 'delivery' ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Delivery address
              <textarea
                autoComplete="street-address"
                rows={2}
                value={deliveryAddress}
                maxLength={500}
                onChange={(event) => {
                  setDeliveryAddress(event.target.value);
                }}
                aria-invalid={showErrors && addressMissing}
                className={`${fieldClass} ${showErrors && addressMissing ? 'border-red-500' : 'border-[var(--t-border)]'}`}
              />
              {showErrors && addressMissing ? <span className="text-xs font-normal text-red-600">Enter where to deliver.</span> : null}
            </label>
          ) : null}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Note for the kitchen <span className="font-normal text-[var(--t-muted)]">(optional)</span>
            <textarea
              rows={2}
              placeholder="Less spicy, no onion…"
              value={notes}
              maxLength={500}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
              className={`${fieldClass} border-[var(--t-border)]`}
            />
          </label>
        </div>

        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => {
            setWebsite(event.target.value);
          }}
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
          aria-hidden="true"
        />

        <div className="sticky bottom-0 flex flex-col gap-2 bg-[var(--t-surface)] pt-2 pb-1">
          {error ? (
            <p role="alert" className="text-center text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handlePlaceOrder()}
            disabled={isSubmitting || cartLines.length === 0}
            className="flex w-full items-center justify-between rounded-2xl bg-[var(--t-accent)] px-5 py-4 text-[15px] font-semibold text-[var(--t-accent-text)] transition-transform active:scale-[.98] disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Sending order…' : 'Place order'}</span>
            <span>{formatRupees(subtotal)}</span>
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- browse */
  return (
    <div className="flex flex-col">
      {(categories ?? []).length > 1 ? (
        <nav
          aria-label="Menu sections"
          className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-[var(--t-surface)] pt-1 pb-3 [scrollbar-width:none]"
        >
          {(categories ?? []).map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                jumpTo(category.id);
              }}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === category.id
                  ? 'border-[var(--t-accent)] bg-[var(--t-accent)] text-[var(--t-accent-text)]'
                  : 'border-[var(--t-border)]'
              }`}
            >
              {category.name}
            </button>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-col gap-6 pb-2">
        {(categories ?? []).map((category) => (
          <section
            key={category.id}
            ref={(element) => {
              sectionRefs.current[category.id] = element;
            }}
            className="flex scroll-mt-14 flex-col gap-1"
            aria-label={category.name}
          >
            <h3 className="text-base font-bold">{category.name}</h3>
            <div className="flex flex-col divide-y divide-[var(--t-border)]">
              {category.items.map((item) => {
                const quantity = cart[item.id] ?? 0;
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="text-[15px] leading-snug font-semibold">{item.name}</p>
                      <p className="text-[15px] font-medium">{formatRupees(Number(item.priceRupees))}</p>
                      {item.description ? (
                        <p className="line-clamp-2 text-[13px] leading-snug text-[var(--t-muted)]">{item.description}</p>
                      ) : null}
                    </div>
                    <div className="flex w-[104px] shrink-0 flex-col items-center">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="aspect-square w-full rounded-xl object-cover"
                        />
                      ) : null}
                      <div className={item.imageUrl ? '-mt-4' : 'mt-1'}>
                        {quantity === 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setQuantity(item.id, 1);
                            }}
                            aria-label={`Add ${item.name}`}
                            className="min-w-[88px] rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2 text-sm font-bold text-[var(--t-accent)] shadow-sm active:scale-95"
                          >
                            ADD
                          </button>
                        ) : (
                          <Stepper
                            name={item.name}
                            quantity={quantity}
                            onChange={(next) => {
                              setQuantity(item.id, next);
                            }}
                            filled
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {cartCount > 0 ? (
        <div className="sticky bottom-0 bg-[var(--t-surface)] pt-2 pb-1">
          <button
            type="button"
            onClick={() => {
              setShowErrors(false);
              setError(null);
              setStep('checkout');
            }}
            className="flex w-full items-center justify-between rounded-2xl bg-[var(--t-accent)] px-5 py-4 text-[15px] font-semibold text-[var(--t-accent-text)] shadow-lg transition-transform active:scale-[.98]"
          >
            <span>
              {cartCount} item{cartCount === 1 ? '' : 's'} · {formatRupees(subtotal)}
            </span>
            <span className="flex items-center gap-1">
              View cart
              <Icon name="chevron-right" className="size-4" />
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Stepper({
  name,
  quantity,
  onChange,
  filled,
}: {
  name: string;
  quantity: number;
  onChange: (next: number) => void;
  filled?: boolean;
}) {
  return (
    <div
      className={`flex min-w-[88px] items-center justify-between rounded-xl border text-sm font-bold shadow-sm ${
        filled
          ? 'border-[var(--t-accent)] bg-[var(--t-accent)] text-[var(--t-accent-text)]'
          : 'border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-accent)]'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          onChange(quantity - 1);
        }}
        aria-label={`Remove one ${name}`}
        className="px-3 py-2 active:scale-90"
      >
        −
      </button>
      <span aria-live="polite" aria-label={`${String(quantity)} ${name} in cart`}>
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => {
          onChange(quantity + 1);
        }}
        aria-label={`Add one ${name}`}
        className="px-3 py-2 active:scale-90"
      >
        +
      </button>
    </div>
  );
}

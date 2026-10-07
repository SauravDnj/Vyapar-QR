'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/auth-context';
import { ApiError, describeOrderType, getLiveOrders, type Order } from '../lib/orders-api';

/**
 * New-order alerts for the whole dashboard.
 *
 * A café owner has the dashboard open on a counter tablet or a laptop and is
 * busy; a quiet bell that refreshes once a minute is how orders got missed.
 * This checks every few seconds from any dashboard page and, when an order
 * arrives, chimes (and keeps chiming until someone looks), shows a desktop
 * notification when the tab is in the background, pops a card with the
 * order, and puts the waiting count in the tab title.
 *
 * It needs nothing configured — no email, SMS or WhatsApp keys — only the
 * dashboard being open somewhere.
 */

const POLL_MS = 10_000;
const REPEAT_CHIME_MS = 20_000;
const MAX_REPEATS = 15;

interface OrderAlertsState {
  pendingCount: number;
  /** Bumps whenever new orders arrive, so pages showing orders can refetch. */
  version: number;
}

const OrderAlertsContext = createContext<OrderAlertsState>({ pendingCount: 0, version: 0 });

export function useOrderAlerts(): OrderAlertsState {
  return useContext(OrderAlertsContext);
}

/** A two-note chime from Web Audio, so there's no sound file to host. */
function playChime(context: AudioContext | null) {
  if (!context || context.state !== 'running') return;
  const start = context.currentTime;
  [880, 1320].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const at = start + index * 0.18;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.55);
  });
}

function orderTitle(order: Order): string {
  return order.orderNumber ? `New order #${String(order.orderNumber)}` : 'New order';
}

function orderSummary(order: Order): string {
  const type = describeOrderType(order);
  const items = order.itemsJson.map((item) => `${String(item.quantity)}× ${item.name}`).join(', ');
  return [`${order.customerName} · ₹${order.totalAmount}`, type, items].filter(Boolean).join(' · ');
}

export function OrderAlertsProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<OrderAlertsState>({ pendingCount: 0, version: 0 });
  const [unseen, setUnseen] = useState<Order[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [soundReady, setSoundReady] = useState(false);
  /** Mirrors `disabledRef` for rendering; the ref is what the poll reads. */
  const [alertsOff, setAlertsOff] = useState(false);

  const sinceRef = useRef<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const disabledRef = useRef(false);

  const isClientUser = user?.role === 'client_admin' || user?.role === 'client_staff';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Notification only exists in the browser
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  // Browsers only allow sound after the person has interacted with the page,
  // so the audio context is created on the first click or key press.
  useEffect(() => {
    function unlock() {
      if (!audioRef.current) {
        const AudioContextClass =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        audioRef.current = new AudioContextClass();
      }
      void audioRef.current.resume().then(() => {
        setSoundReady(true);
      });
    }
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const poll = useCallback(async () => {
    if (!accessToken || !isClientUser || disabledRef.current) return;
    try {
      const result = await getLiveOrders(accessToken, sinceRef.current);
      const isFirstPoll = sinceRef.current === null;
      sinceRef.current = result.serverTime;
      // The first poll only sets the starting point: orders already waiting
      // when the dashboard opens show in the count, without a chime.
      const fresh = isFirstPoll ? [] : result.newOrders;
      setState((previous) => ({
        pendingCount: result.pendingCount,
        version: fresh.length > 0 ? previous.version + 1 : previous.version,
      }));
      if (fresh.length === 0) return;

      setUnseen((previous) => {
        const known = new Set(previous.map((order) => order.id));
        return [...fresh.filter((order) => !known.has(order.id)), ...previous].slice(0, 5);
      });
      playChime(audioRef.current);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        for (const order of fresh.slice(0, 3)) {
          const notification = new Notification(orderTitle(order), { body: orderSummary(order), tag: `order-${order.id}` });
          notification.onclick = () => {
            window.focus();
            router.push('/dashboard/orders');
          };
        }
      }
    } catch (error) {
      // No ordering on this plan, or this staff member can't see orders:
      // stop asking rather than fail every 10 seconds.
      if (error instanceof ApiError && (error.status === 403 || error.status === 401)) {
        if (error.status === 403) {
          disabledRef.current = true;
          setAlertsOff(true);
        }
      }
    }
  }, [accessToken, isClientUser, router]);

  useEffect(() => {
    if (!accessToken || !isClientUser) return;
    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    const onFocus = () => void poll();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [accessToken, isClientUser, poll]);

  // Keep chiming while an alert is unacknowledged — a kitchen is loud and
  // one chime is easy to miss — but not forever.
  useEffect(() => {
    if (unseen.length === 0) return;
    let repeats = 0;
    const interval = setInterval(() => {
      repeats += 1;
      if (repeats > MAX_REPEATS) {
        clearInterval(interval);
        return;
      }
      playChime(audioRef.current);
    }, REPEAT_CHIME_MS);
    return () => {
      clearInterval(interval);
    };
  }, [unseen.length]);

  // Opening the orders page counts as having seen them.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route change acknowledges the alert
    if (pathname.startsWith('/dashboard/orders')) setUnseen([]);
  }, [pathname, state.version]);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = state.pendingCount > 0 ? `(${String(state.pendingCount)}) ${base}` : base;
  }, [state.pendingCount, pathname]);

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  }

  const showSetup = isClientUser && !alertsOff && (permission === 'default' || !soundReady);

  return (
    <OrderAlertsContext.Provider value={state}>
      {children}

      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {unseen.map((order) => (
          <div
            key={order.id}
            role="alert"
            className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-accent bg-surface p-4 text-sm"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold">🔔 {orderTitle(order)}</p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => {
                  setUnseen((previous) => previous.filter((entry) => entry.id !== order.id));
                }}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-muted">{orderSummary(order)}</p>
            <Link
              href="/dashboard/orders"
              onClick={() => {
                setUnseen([]);
              }}
              className="w-fit rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground"
            >
              View order
            </Link>
          </div>
        ))}

        {showSetup && state.version === 0 && unseen.length === 0 ? (
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-lg border border-border-color bg-surface px-3 py-2 text-xs text-muted">
            <span>
              {permission === 'default'
                ? 'Get an alert the moment an order comes in.'
                : 'Click anywhere once so new orders can play a sound.'}
            </span>
            {permission === 'default' ? (
              <button
                type="button"
                onClick={() => void enableNotifications()}
                className="shrink-0 rounded-md bg-accent px-2.5 py-1 font-medium text-accent-foreground"
              >
                Turn on
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </OrderAlertsContext.Provider>
  );
}

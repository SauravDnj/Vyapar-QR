'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from './icon';

import type { PaymentMethodType, PublicPaymentMethod } from '@qrhub/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

const APP_LABEL: Record<PaymentMethodType, string> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  other: 'UPI',
};

/**
 * Bare app schemes — used only to open the app so the visitor can scan the
 * on-screen QR themselves (no UPI ID is available in that branch, so there's
 * nothing to deep-link with). The path-specific `tez://upi/pay` forms expect
 * real UPI query params and are for the one-tap case, which uses a generic
 * `upi://pay?...` link so any installed UPI app can handle it.
 */
const APP_SCHEME: Partial<Record<PaymentMethodType, string>> = {
  gpay: 'tez://',
  phonepe: 'phonepe://',
  paytm: 'paytmmp://',
};

/**
 * Theme-aware styling.
 *
 * These read the custom properties `TokenTheme` sets, with fallbacks so the
 * component still looks right inside the thirteen bespoke themes (which don't
 * set them) and in the admin preview. Previously every button was hardcoded
 * `bg-emerald-600`, so a business's pay button was green no matter what its
 * theme's brand colour was.
 */
const ACCENT_BUTTON = {
  backgroundColor: 'var(--t-accent, #047857)',
  color: 'var(--t-accent-text, #ffffff)',
  borderRadius: 'var(--t-radius, 10px)',
};
const CARD = {
  borderColor: 'var(--t-border, #e5e7eb)',
  borderRadius: 'var(--t-radius, 10px)',
};
/** `--t-muted` is contrast-verified against every catalog surface. */
const MUTED = { color: 'var(--t-muted, #4b5563)' };

function upiLink(upiId: string, businessName: string, amount?: string): string {
  const base = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(businessName)}&cu=INR`;
  const parsed = amount ? Number(amount) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? `${base}&am=${parsed.toFixed(2)}` : base;
}

function trackClick(slug: string | undefined, label: string) {
  if (!slug) return;
  void fetch(`${API_URL}/public/landing/${slug}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'button_click', meta: { label } }),
    keepalive: true,
  });
}

async function claimPayment(slug: string, amount: number, method: PaymentMethodType) {
  const response = await fetch(`${API_URL}/public/landing/${slug}/payment/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, method }),
  });
  if (!response.ok) {
    throw new Error('Request failed');
  }
  return (await response.json()) as { notified: boolean; whatsappUrl: string | null };
}

type ClaimState = 'idle' | 'sending' | 'sent' | 'needs-manual-send' | 'error';

function AmountPayCard({
  slug,
  businessName,
  method,
  upiId,
  qrImageUrl,
}: {
  slug?: string;
  businessName: string;
  method: PaymentMethodType;
  upiId: string;
  qrImageUrl?: string | null;
}) {
  const label = APP_LABEL[method];
  const [amount, setAmount] = useState('');
  const [hasOpened, setHasOpened] = useState(false);
  const [noAppFound, setNoAppFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claimState, setClaimState] = useState<ClaimState>('idle');
  const [manualSendUrl, setManualSendUrl] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handlePay() {
    trackClick(slug, method);

    // `upi://` is a mobile-only scheme. On a desktop browser the navigation is
    // doomed: nothing handles it, the click appears to do nothing, and the
    // visitor concludes the page is broken — which is exactly how "payments
    // don't work" presents when a business tests on a laptop. Worse, the
    // attempted navigation tears the page context down, so a timeout-based
    // fallback never runs.
    //
    // So don't attempt it where it cannot succeed. A coarse pointer means a
    // touch device, which is where a UPI app might actually be installed;
    // everywhere else goes straight to what does work — the QR to scan with a
    // phone and the UPI ID to copy.
    const touchDevice =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

    if (!touchDevice) {
      setNoAppFound(true);
      setHasOpened(true);
      return;
    }

    setHasOpened(true);
    setNoAppFound(false);
    window.location.href = upiLink(upiId, businessName, amount);

    // On a touch device an app normally takes over and hides this page. If it
    // is still visible shortly after, nothing handled the link — fall back to
    // the same QR and UPI ID.
    timer.current = setTimeout(() => {
      if (document.visibilityState === 'visible') setNoAppFound(true);
    }, 1500);
  }

  async function handleClaimPaid() {
    if (!slug) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setClaimState('sending');
    try {
      const result = await claimPayment(slug, parsed, method);
      if (result.notified) {
        setClaimState('sent');
      } else if (result.whatsappUrl) {
        setManualSendUrl(result.whatsappUrl);
        setClaimState('needs-manual-send');
      } else {
        setClaimState('sent');
      }
    } catch {
      setClaimState('error');
    }
  }

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard can be blocked; the ID is displayed as selectable text too.
    }
  }

  const amountValid = Number.isFinite(Number(amount)) && Number(amount) > 0;
  const inputId = `amount-${method}`;

  return (
    <div className="flex flex-col gap-3 border p-4" style={CARD}>
      <p className="text-sm font-semibold">Pay with {label}</p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-xs font-medium" style={MUTED}>
          Amount (optional)
        </label>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" style={MUTED}>
            ₹
          </span>
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setHasOpened(false);
              setNoAppFound(false);
              setClaimState('idle');
            }}
            placeholder="Leave blank to enter it in the app"
            className="min-h-11 w-full border px-3 py-2 text-sm"
            style={CARD}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handlePay}
        className="flex min-h-11 cursor-pointer items-center justify-center gap-2 px-6 py-3 font-medium transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
        style={ACCENT_BUTTON}
      >
        {amount ? `Pay ₹${amount} with ${label}` : `Pay with ${label}`}
      </button>

      {noAppFound ? (
        <div className="flex flex-col items-center gap-3 border-t pt-3" style={{ borderColor: 'var(--t-border, #e5e7eb)' }}>
          <p className="text-center text-sm" style={MUTED}>
            UPI apps only open on a phone. Scan this with your phone&apos;s UPI app,
            or copy the UPI ID below.
          </p>
          {qrImageUrl ? (
            <img src={qrImageUrl} alt={`${label} payment QR code`} className="size-44 object-contain" />
          ) : null}
          <button
            type="button"
            onClick={() => void copyUpiId()}
            className="flex min-h-11 cursor-pointer items-center gap-2 border px-4 py-2 text-sm font-medium transition-opacity duration-200 hover:opacity-80"
            style={CARD}
          >
            <Icon name={copied ? 'check' : 'share'} className="size-4" aria-hidden="true" />
            <span className="font-mono">{upiId}</span>
          </button>
          <span aria-live="polite" className="sr-only">
            {copied ? 'UPI ID copied' : ''}
          </span>
          {copied ? (
            <p className="text-xs" style={MUTED}>
              Copied
            </p>
          ) : null}
        </div>
      ) : null}

      {hasOpened ? (
        <div className="flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: 'var(--t-border, #e5e7eb)' }}>
          {claimState === 'sent' ? (
            <p className="flex items-center justify-center gap-2 text-center text-sm font-medium">
              <Icon name="check" className="size-4" />
              Thanks — we&apos;ve let {businessName} know.
            </p>
          ) : claimState === 'needs-manual-send' && manualSendUrl ? (
            <>
              <a
                href={manualSendUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-opacity duration-200 hover:opacity-90"
                style={ACCENT_BUTTON}
              >
                <Icon name="external" className="size-4" />
                Open WhatsApp to confirm
              </a>
              <p className="text-center text-xs" style={MUTED}>
                Opens WhatsApp with the message ready — just tap send.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleClaimPaid()}
                disabled={claimState === 'sending' || !amountValid}
                title={amountValid ? undefined : 'Enter the amount you paid first'}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 text-center text-sm font-medium underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="check" className="size-4" />
                {claimState === 'sending' ? 'Letting them know…' : `I've paid — notify ${businessName}`}
              </button>
              <p className="text-center text-xs" style={MUTED}>
                This only tells {businessName} you paid — it is not a verified receipt.
                Keep your UPI app&apos;s confirmation for that.
              </p>
              {claimState === 'error' ? (
                <p className="text-center text-xs font-medium text-red-700" role="alert">
                  Couldn&apos;t send that — please try again.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PaymentButtons({
  slug,
  businessName,
  paymentMethods,
}: {
  slug?: string;
  businessName: string;
  paymentMethods: PublicPaymentMethod[];
}) {
  const methods = [...paymentMethods].sort((a, b) => a.displayOrder - b.displayOrder);
  if (methods.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {methods.map((method) => {
        const label = APP_LABEL[method.type];

        if (method.upiId) {
          return (
            <AmountPayCard
              key={method.id}
              slug={slug}
              businessName={businessName}
              method={method.type}
              upiId={method.upiId}
              qrImageUrl={method.qrImageUrl}
            />
          );
        }

        if (method.qrImageUrl) {
          const scheme = APP_SCHEME[method.type];
          return (
            <div key={method.id} className="flex flex-col items-center gap-3 border p-4" style={CARD}>
              <img src={method.qrImageUrl} alt={`${label} payment QR code`} className="size-48 object-contain" />
              <p className="text-sm" style={MUTED}>
                Scan this with {label}
              </p>
              {scheme ? (
                <a
                  href={scheme}
                  onClick={() => {
                    trackClick(slug, method.type);
                  }}
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium transition-opacity duration-200 hover:opacity-90 md:hidden"
                  style={ACCENT_BUTTON}
                >
                  <Icon name="external" className="size-4" />
                  Open {label}
                </a>
              ) : null}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

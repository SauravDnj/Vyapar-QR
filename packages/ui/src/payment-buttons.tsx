'use client';

import { useEffect, useRef, useState } from 'react';

import { PlatformLogo } from './brand-logos';
import { Icon } from './icon';

import type { PaymentMethodType, PublicPaymentMethod } from '@vyaparqr/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

const APP_LABEL: Record<PaymentMethodType, string> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  // Not one app: the plain `upi://` scheme makes the phone list every UPI app
  // installed on it, so the customer pays with whichever they actually use.
  other: 'any UPI app',
};

/** Each app's own mark, so the card is identified by the logo the customer
 * already looks for on their home screen rather than by our wording alone. */
const APP_BRAND = { gpay: 'gpay', phonepe: 'phonepe', paytm: 'paytm', other: 'upi' } as const;

/** Bare app schemes, for opening an app so the visitor can scan an on-screen QR. */
const APP_SCHEME: Partial<Record<PaymentMethodType, string>> = {
  gpay: 'tez://',
  phonepe: 'phonepe://',
  paytm: 'paytmmp://',
};

/**
 * Per-app UPI deep links.
 *
 * A generic `upi://pay?…` makes Android show a "choose an app" sheet, which is
 * wrong when the customer just tapped a button that says *Google Pay* — they
 * asked for one app and got a chooser. Each app registers its own scheme
 * carrying the same UPI parameters, so tapping the PhonePe button opens
 * PhonePe with the amount already filled in.
 */
const UPI_SCHEME: Record<PaymentMethodType, string> = {
  gpay: 'tez://upi/pay',
  phonepe: 'phonepe://pay',
  paytm: 'paytmmp://pay',
  // No specific app requested, so the chooser is the correct behaviour here.
  other: 'upi://pay',
};

/** Android package ids, used to build an `intent://` URL. */
const ANDROID_PACKAGE: Partial<Record<PaymentMethodType, string>> = {
  gpay: 'com.google.android.apps.nbu.paisa.user',
  phonepe: 'com.phonepe.app',
  paytm: 'net.one97.paytm',
};

/**
 * Theme-aware styling.
 *
 * These read the custom properties every theme sets, with fallbacks so the
 * component still looks right anywhere they aren't set. Previously every button was hardcoded
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

/** The UPI query string every scheme below shares. */
function upiParams(upiId: string, businessName: string, amount?: string): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: businessName,
    cu: 'INR',
  });
  const parsed = amount ? Number(amount) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    params.set('am', parsed.toFixed(2));
  }
  return params.toString();
}

/**
 * The link that opens the app the customer actually asked for.
 *
 * On Android an `intent://` URL naming the package is the most reliable form:
 * if the app isn't installed the OS falls back to `S.browser_fallback_url`
 * instead of dumping the visitor on an error page, which a bare custom scheme
 * does. Elsewhere (iOS) the app's own scheme is used.
 */
function upiLink(
  method: PaymentMethodType,
  upiId: string,
  businessName: string,
  amount: string | undefined,
  isAndroid: boolean,
): string {
  const query = upiParams(upiId, businessName, amount);
  const androidPackage = ANDROID_PACKAGE[method];

  if (isAndroid && androidPackage) {
    const fallback = encodeURIComponent(`upi://pay?${query}`);
    return `intent://pay?${query}#Intent;scheme=upi;package=${androidPackage};S.browser_fallback_url=${fallback};end`;
  }

  return `${UPI_SCHEME[method]}?${query}`;
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

async function claimPayment(slug: string, amount: number | undefined, method: PaymentMethodType) {
  const response = await fetch(`${API_URL}/public/landing/${slug}/payment/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, method }),
  });
  if (!response.ok) {
    throw new Error('Request failed');
  }
  return (await response.json()) as { claimId: string | null; notified: boolean; whatsappUrl: string | null };
}

/** Undo, for someone who came back from their UPI app without paying. */
async function cancelClaim(slug: string, claimId: string) {
  await fetch(`${API_URL}/public/landing/${slug}/payment/claim/${claimId}/cancel`, {
    method: 'POST',
    keepalive: true,
  });
}

/** The optional name and number, which is what puts the payment in the CRM
 * against a contact the business can follow up with. */
async function attachCustomer(slug: string, claimId: string, body: { name?: string; phone?: string }) {
  const response = await fetch(`${API_URL}/public/landing/${slug}/payment/claim/${claimId}/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error('Request failed');
  }
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
  const [claimId, setClaimId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [detailsState, setDetailsState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set while the customer is away in their UPI app, so coming back records
   * the payment without them having to tap anything else. */
  const awaitingReturn = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /**
   * Records the payment when the customer comes back from their UPI app.
   *
   * They tapped Pay, the app took over, and they returned — that is the whole
   * signal we get, because a UPI deep link reports nothing back. So the page
   * stops asking "did you pay?" and simply says thank you, while the record
   * itself is stored as an unverified claim for the owner to confirm against
   * their own UPI app. "Not paid" undoes it in one tap.
   */
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible' || !awaitingReturn.current) {
        return;
      }
      awaitingReturn.current = false;
      void recordPayment();
    }

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
    // `recordPayment` closes over the amount, which the customer can still be
    // editing when they tap Pay, so the listener is re-attached as it changes.
  }, [amount, slug, method]);

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
    awaitingReturn.current = true;
    const isAndroid = /android/i.test(navigator.userAgent);
    window.location.href = upiLink(method, upiId, businessName, amount, isAndroid);

    // On a touch device an app normally takes over and hides this page. If it
    // is still visible shortly after, nothing handled the link — fall back to
    // the same QR and UPI ID.
    timer.current = setTimeout(() => {
      if (document.visibilityState === 'visible') {
        setNoAppFound(true);
        awaitingReturn.current = false;
      }
    }, 1500);
  }

  async function recordPayment() {
    if (!slug || claimState === 'sending' || claimState === 'sent') return;
    const parsed = Number(amount);
    const paidAmount = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    setClaimState('sending');
    try {
      const result = await claimPayment(slug, paidAmount, method);
      setClaimId(result.claimId);
      if (!result.notified && result.whatsappUrl) {
        setManualSendUrl(result.whatsappUrl);
        setClaimState('needs-manual-send');
      } else {
        setClaimState('sent');
      }
    } catch {
      setClaimState('error');
    }
  }

  async function handleNotPaid() {
    if (slug && claimId) {
      await cancelClaim(slug, claimId);
    }
    setClaimId(null);
    setClaimState('idle');
    setHasOpened(false);
  }

  async function handleSaveDetails() {
    if (!slug || !claimId || !customerPhone.trim()) return;
    setDetailsState('saving');
    try {
      await attachCustomer(slug, claimId, { name: customerName.trim() || undefined, phone: customerPhone.trim() });
      setDetailsState('saved');
    } catch {
      setDetailsState('idle');
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
      <p className="flex items-center gap-2 text-sm font-semibold">
        <PlatformLogo brand={APP_BRAND[method]} className="h-5 w-auto shrink-0" />
        Pay with {label}
      </p>

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

      {hasOpened && !noAppFound ? (
        <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: 'var(--t-border, #e5e7eb)' }}>
          {claimState === 'sending' ? (
            <p className="text-center text-sm" style={MUTED}>
              Saving your payment&hellip;
            </p>
          ) : null}

          {claimState === 'sent' || claimState === 'needs-manual-send' ? (
            <>
              <p className="flex items-center justify-center gap-2 text-center text-sm font-medium">
                <Icon name="check" className="size-4" />
                Thank you{amountValid ? ` for \u20B9${amount}` : ''}! {businessName} has been told.
              </p>

              {claimState === 'needs-manual-send' && manualSendUrl ? (
                <a
                  href={manualSendUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-opacity duration-200 hover:opacity-90"
                  style={ACCENT_BUTTON}
                >
                  <Icon name="external" className="size-4" />
                  Send the confirmation on WhatsApp
                </a>
              ) : null}

              {/* A number turns this payment into a customer the business can
                  thank or follow up with. Asked after paying, never before. */}
              {detailsState === 'saved' ? (
                <p className="text-center text-xs" style={MUTED}>
                  Saved — {businessName} has your number.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="text-center text-xs" style={MUTED}>
                    Want the receipt or offers on WhatsApp? (optional)
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={customerName}
                      onChange={(event) => {
                        setCustomerName(event.target.value);
                      }}
                      placeholder="Name"
                      className="min-h-11 w-1/3 border px-3 py-2 text-sm"
                      style={CARD}
                    />
                    <input
                      value={customerPhone}
                      onChange={(event) => {
                        setCustomerPhone(event.target.value);
                      }}
                      type="tel"
                      inputMode="tel"
                      placeholder="Your number"
                      className="min-h-11 min-w-0 flex-1 border px-3 py-2 text-sm"
                      style={CARD}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveDetails()}
                      disabled={detailsState === 'saving' || customerPhone.trim() === ''}
                      className="min-h-11 cursor-pointer px-4 py-2 text-sm font-medium disabled:opacity-50"
                      style={ACCENT_BUTTON}
                    >
                      {detailsState === 'saving' ? '\u2026' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => void handleNotPaid()}
                  className="cursor-pointer text-xs underline underline-offset-2"
                  style={MUTED}
                >
                  I didn&apos;t pay &mdash; undo
                </button>
              </div>

              <p className="text-center text-[11px]" style={MUTED}>
                This records what you paid; it is not a verified receipt. Keep your UPI
                app&apos;s confirmation for that.
              </p>
            </>
          ) : null}

          {claimState === 'error' ? (
            <>
              <p className="text-center text-xs font-medium text-red-700" role="alert">
                Couldn&apos;t save that automatically.
              </p>
              <button
                type="button"
                onClick={() => void recordPayment()}
                className="min-h-11 cursor-pointer text-center text-sm font-medium underline underline-offset-2"
              >
                Tell {businessName} I&apos;ve paid
              </button>
            </>
          ) : null}
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
              <p className="flex items-center gap-2 text-sm" style={MUTED}>
                <PlatformLogo brand={APP_BRAND[method.type]} className="h-5 w-auto shrink-0" />
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

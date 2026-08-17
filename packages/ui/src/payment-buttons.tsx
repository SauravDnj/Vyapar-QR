'use client';

import { useState } from 'react';

import type { PaymentMethodType, PublicPaymentMethod } from '@qrhub/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

const APP_LABEL: Record<PaymentMethodType, string> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  other: 'UPI',
};

/** Bare app schemes — used only to open the app so the visitor can scan the
 * QR image on-screen themselves (no UPI ID is available in this branch, so
 * there's nothing to deep-link with). The path-specific `tez://upi/pay`,
 * `phonepe://pay`, `paytmmp://pay` forms expect real UPI query params
 * (`pa`/`pn`/`cu`) and are for the one-tap case below instead, where a real
 * `upi://pay?...` link is used (works with any installed UPI app, not just
 * one specific one). */
const APP_SCHEME: Partial<Record<PaymentMethodType, string>> = {
  gpay: 'tez://',
  phonepe: 'phonepe://',
  paytm: 'paytmmp://',
};

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
  return (await response.json()) as { notified: boolean };
}

type ClaimState = 'idle' | 'sending' | 'sent' | 'error';

function AmountPayCard({
  slug,
  businessName,
  method,
  upiId,
}: {
  slug?: string;
  businessName: string;
  method: PaymentMethodType;
  upiId: string;
}) {
  const label = APP_LABEL[method];
  const [amount, setAmount] = useState('');
  const [hasOpened, setHasOpened] = useState(false);
  const [claimState, setClaimState] = useState<ClaimState>('idle');

  function handlePay() {
    trackClick(slug, method);
    setHasOpened(true);
    window.location.href = upiLink(upiId, businessName, amount);
  }

  async function handleClaimPaid() {
    if (!slug) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setClaimState('sending');
    try {
      await claimPayment(slug, parsed, method);
      setClaimState('sent');
    } catch {
      setClaimState('error');
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-sm font-medium">Pay with {label}</p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">₹</span>
        <input
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setHasOpened(false);
            setClaimState('idle');
          }}
          placeholder="Amount"
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={handlePay}
        className="flex items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700"
      >
        Pay {amount ? `₹${amount}` : ''} with {label}
      </button>

      {hasOpened ? (
        <div className="flex flex-col gap-1 border-t pt-2">
          {claimState === 'sent' ? (
            <p className="text-center text-sm text-emerald-700">Thanks! We&apos;ve let {businessName} know.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleClaimPaid()}
                disabled={claimState === 'sending'}
                className="text-center text-sm font-medium text-emerald-700 underline disabled:opacity-50"
              >
                {claimState === 'sending' ? 'Letting them know…' : "✅ I've paid — notify " + businessName}
              </button>
              <p className="text-center text-[11px] text-gray-400">
                This just tells {businessName} you paid — it&apos;s not a verified receipt. Keep your UPI app&apos;s confirmation for that.
              </p>
              {claimState === 'error' ? <p className="text-center text-xs text-red-600">Couldn&apos;t send that — try again.</p> : null}
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
          return <AmountPayCard key={method.id} slug={slug} businessName={businessName} method={method.type} upiId={method.upiId} />;
        }

        if (method.qrImageUrl) {
          const scheme = APP_SCHEME[method.type];
          return (
            <div key={method.id} className="flex flex-col items-center gap-2 rounded-lg border p-4">
              <img src={method.qrImageUrl} alt={`${label} QR code`} className="h-48 w-48 object-contain" />
              {scheme ? (
                <a
                  href={scheme}
                  onClick={() => {
                    trackClick(slug, method.type);
                  }}
                  className="text-sm font-medium text-emerald-700 underline md:hidden"
                >
                  Open {label}
                </a>
              ) : null}
              <p className="text-xs text-gray-500">Scan the QR above with {label}</p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

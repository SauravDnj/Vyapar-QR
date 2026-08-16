'use client';

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

function upiLink(upiId: string, businessName: string): string {
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(businessName)}&cu=INR`;
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
            <a
              key={method.id}
              href={upiLink(method.upiId, businessName)}
              onClick={() => {
                trackClick(slug, method.type);
              }}
              className="flex items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700"
            >
              Pay with {label}
            </a>
          );
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

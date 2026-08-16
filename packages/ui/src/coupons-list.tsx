'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

interface PublicCoupon {
  code: string;
  description: string;
  discountText: string;
}

/** Self-fetching, like `ReviewFunnel`/`ContactForm` — coupons aren't part
 * of the main landing-page payload since they're a small, independently
 * changing list, not core page content. */
export function CouponsList({ slug }: { slug?: string }) {
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      const response = await fetch(`${API_URL}/public/landing/${slug}/coupons`);
      if (response.ok) {
        setCoupons((await response.json()) as PublicCoupon[]);
      }
    })();
  }, [slug]);

  if (coupons.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-center text-sm font-medium uppercase tracking-wide text-gray-400">Special offers</h2>
      <div className="flex flex-col gap-2">
        {coupons.map((coupon) => (
          <div key={coupon.code} className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-current/30 p-3 text-center">
            <p className="font-mono text-lg font-semibold tracking-wide">{coupon.code}</p>
            <p className="text-sm">{coupon.discountText}</p>
            <p className="text-xs text-gray-500">{coupon.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

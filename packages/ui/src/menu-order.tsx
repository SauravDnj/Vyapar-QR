'use client';

import { useEffect, useState } from 'react';

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

type Step = 'browse' | 'checkout' | 'sent';

/** Self-fetching, like `CouponsList`/`ReviewFunnel` — the menu isn't part
 * of the main landing-page payload, and availability/pricing needs to stay
 * fresh rather than sit in the 5-minute ISR cache. */
export function MenuOrder({ slug }: { slug?: string }) {
  const [categories, setCategories] = useState<PublicMenuCategory[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>('browse');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — must stay hidden from real users
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      const response = await fetch(`${API_URL}/public/landing/${slug}/menu`);
      if (response.ok) {
        setCategories((await response.json()) as PublicMenuCategory[]);
      }
    })();
  }, [slug]);

  if (!slug || categories.length === 0) {
    return null;
  }

  const clientSlug: string = slug;
  const items = categories.flatMap((category) => category.items);
  const cartEntries = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  const cartCount = cartEntries.reduce((sum, [, quantity]) => sum + quantity, 0);
  const subtotal = cartEntries.reduce((sum, [itemId, quantity]) => {
    const item = items.find((candidate) => candidate.id === itemId);
    return sum + (item ? Number(item.priceRupees) * quantity : 0);
  }, 0);

  function setQuantity(itemId: string, quantity: number) {
    setCart((current) => ({ ...current, [itemId]: Math.max(0, quantity) }));
  }

  async function handlePlaceOrder() {
    if (!customerName.trim() || !customerPhone.trim() || cartEntries.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/public/landing/${clientSlug}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          items: cartEntries.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
          notes: notes.trim() || undefined,
          website: website || undefined,
        }),
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      setStep('sent');
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 'sent') {
    return <p className="text-center text-sm text-emerald-700">Order sent! They&apos;ll confirm on WhatsApp shortly.</p>;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-center text-sm font-medium uppercase tracking-wide text-gray-400">Menu</h2>

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

      {step === 'browse' ? (
        <div className="flex flex-col gap-5">
          {categories.map((category) => (
            <div key={category.id} className="flex flex-col gap-2">
              <p className="text-sm font-semibold">{category.name}</p>
              {category.items.map((item) => {
                const quantity = cart[item.id] ?? 0;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <div className="flex flex-col">
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.description ? <p className="text-xs text-gray-500">{item.description}</p> : null}
                      <p className="text-sm">₹{item.priceRupees}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setQuantity(item.id, quantity - 1);
                        }}
                        disabled={quantity === 0}
                        className="h-7 w-7 rounded-full border text-sm disabled:opacity-30"
                        aria-label={`Remove one ${item.name}`}
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-sm">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuantity(item.id, quantity + 1);
                        }}
                        className="h-7 w-7 rounded-full border text-sm"
                        aria-label={`Add one ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {cartCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setStep('checkout');
              }}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Checkout — {String(cartCount)} item{cartCount === 1 ? '' : 's'} (₹{subtotal.toFixed(2)})
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm text-gray-500">
            {String(cartCount)} item{cartCount === 1 ? '' : 's'} — ₹{subtotal.toFixed(2)}
          </p>
          <input
            type="text"
            required
            placeholder="Your name"
            value={customerName}
            onChange={(event) => {
              setCustomerName(event.target.value);
            }}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            type="tel"
            required
            placeholder="Your phone number"
            value={customerPhone}
            onChange={(event) => {
              setCustomerPhone(event.target.value);
            }}
            className="rounded border px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            rows={2}
            className="rounded border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setStep('browse');
              }}
              className="rounded border px-4 py-2 text-sm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void handlePlaceOrder()}
              disabled={isSubmitting || !customerName.trim() || !customerPhone.trim()}
              className="flex-1 rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSubmitting ? 'Sending…' : 'Place order'}
            </button>
          </div>
          {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
        </div>
      )}
    </section>
  );
}

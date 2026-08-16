'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';
const MAX_SLOTS_SHOWN = 8;

interface PublicSlot {
  id: string;
  startsAt: string;
  durationMinutes: number;
}

/** Self-fetching, same reasoning as `CouponsList` — open slots change
 * independently of the rest of the page content. */
export function BookingSlotsWidget({ slug }: { slug?: string }) {
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedId, setBookedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      const response = await fetch(`${API_URL}/public/landing/${slug}/booking-slots`);
      if (response.ok) {
        setSlots((await response.json()) as PublicSlot[]);
      }
    })();
  }, [slug]);

  if (!slug || slots.length === 0) {
    return null;
  }

  async function handleBook() {
    if (!slug || !selectedId || !name.trim() || !phone.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/public/landing/${slug}/booking-slots/${selectedId}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      if (!response.ok) {
        throw new Error('This slot is no longer available.');
      }
      setBookedId(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (bookedId) {
    return <p className="text-center text-sm text-emerald-700">You&apos;re booked! We&apos;ll see you then.</p>;
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        {slots.slice(0, MAX_SLOTS_SHOWN).map((slot) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => {
              setSelectedId(slot.id);
            }}
            className={`rounded-md border px-3 py-1.5 text-sm ${selectedId === slot.id ? 'border-current bg-current/10' : 'border-current/30'}`}
          >
            {new Date(slot.startsAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}
          </button>
        ))}
      </div>

      {selectedId ? (
        <div className="flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="Your name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
            }}
            placeholder="Phone number"
            className="rounded border px-3 py-2 text-sm"
          />
          <button
            onClick={() => void handleBook()}
            disabled={isSubmitting || !name.trim() || !phone.trim()}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Booking…' : 'Confirm booking'}
          </button>
          {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { createBulkBookingSlots, deleteBookingSlot, listBookingSlots, type BookingSlot } from '../../../lib/bookings-api';

function BookingsContent() {
  const { accessToken } = useAuth();
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [isCreating, setIsCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      setSlots(await listBookingSlots(accessToken));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleGenerate() {
    if (!accessToken || !date) return;
    setIsCreating(true);
    setMessage(null);
    try {
      const created = await createBulkBookingSlots(accessToken, { date, startTime, endTime, intervalMinutes });
      setSlots((prev) => [...prev, ...created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    } catch {
      setMessage('Failed to generate slots — check the time range.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return;
    setSlots((prev) => prev.filter((slot) => slot.id !== id));
    try {
      await deleteBookingSlot(accessToken, id);
    } catch {
      setMessage('Failed to delete — it may already be booked.');
      await refresh();
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  const open = slots.filter((slot) => !slot.isBooked);
  const booked = slots.filter((slot) => slot.isBooked);

  return (
    <>
      <h1 className="text-2xl font-semibold">Appointment booking</h1>
      <p className="text-sm text-muted">
        Generate available time slots — customers pick one right on your page. This is separate from (and works
        alongside) an external booking link.
      </p>
      {message && <p className="text-sm text-danger">{message}</p>}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border-color p-4">
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-border-color px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Start
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          End
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Slot length (min)
          <input
            type="number"
            min={5}
            max={240}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            className="w-24 rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <button
          disabled={isCreating || !date}
          onClick={() => void handleGenerate()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {isCreating ? 'Generating…' : 'Generate slots'}
        </button>
      </div>

      <h2 className="text-lg font-medium">Open slots ({open.length})</h2>
      {open.length === 0 ? (
        <p className="text-sm text-muted">No open slots — generate some above.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {open.map((slot) => (
            <div key={slot.id} className="flex items-center gap-2 rounded-md border border-border-color bg-surface px-3 py-1.5 text-sm">
              {new Date(slot.startsAt).toLocaleString()}
              <button onClick={() => void handleDelete(slot.id)} className="text-xs text-muted underline">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-medium">Booked ({booked.length})</h2>
      {booked.length === 0 ? (
        <p className="text-sm text-muted">No bookings yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {booked.map((slot) => (
            <div key={slot.id} className="rounded-md border border-border-color bg-surface p-3 text-sm">
              <p className="font-medium">{new Date(slot.startsAt).toLocaleString()}</p>
              <p className="text-muted">
                {slot.customerName} · {slot.customerPhone}
                {slot.notes ? ` · ${slot.notes}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function BookingsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <BookingsContent />
    </ProtectedRoute>
  );
}

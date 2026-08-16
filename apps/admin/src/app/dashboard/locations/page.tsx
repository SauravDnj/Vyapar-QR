'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import {
  addLocation,
  getOnboardingStatus,
  removeLocation,
  updateLocation,
  type OnboardingLocation,
} from '../../../lib/onboarding-api';

const MAX_LOCATIONS = 20;

const EMPTY_FORM = { name: '', address: '', phone: '', hours: '' };

function LocationsContent() {
  const { accessToken } = useAuth();
  const [locations, setLocations] = useState<OnboardingLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const status = await getOnboardingStatus(accessToken);
      setLocations(status.locations);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleAdd() {
    if (!accessToken || !form.name.trim() || !form.address.trim()) return;
    setIsAdding(true);
    setMessage(null);
    try {
      const created = await addLocation(accessToken, {
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || undefined,
        hours: form.hours.trim() || undefined,
      });
      setLocations((prev) => [...prev, created]);
      setForm(EMPTY_FORM);
    } catch {
      setMessage('Failed to add location.');
    } finally {
      setIsAdding(false);
    }
  }

  function startEdit(location: OnboardingLocation) {
    setEditingId(location.id);
    setEditForm({
      name: location.name,
      address: location.address,
      phone: location.phone ?? '',
      hours: location.hours ?? '',
    });
  }

  async function handleSaveEdit(id: string) {
    if (!accessToken) return;
    setIsSavingEdit(true);
    setMessage(null);
    try {
      const updated = await updateLocation(accessToken, id, {
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        phone: editForm.phone.trim() || undefined,
        hours: editForm.hours.trim() || undefined,
      });
      setLocations((prev) => prev.map((loc) => (loc.id === id ? updated : loc)));
      setEditingId(null);
    } catch {
      setMessage('Failed to save changes.');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleRemove(id: string) {
    if (!accessToken) return;
    setLocations((prev) => prev.filter((loc) => loc.id !== id));
    try {
      await removeLocation(accessToken, id);
    } catch {
      setMessage('Failed to remove location.');
      await refresh();
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Locations</h1>
      <p className="text-sm text-muted">
        Add your branches — all locations show as a list on your single landing page. Each can also get its own
        trackable QR code from the <a href="/dashboard/qr-codes" className="text-accent underline">Promo QR codes</a> page.
      </p>
      {message && <p className="text-sm text-danger">{message}</p>}

      <div className="flex flex-col gap-3">
        {locations.map((location) =>
          editingId === location.id ? (
            <div key={location.id} className="flex flex-col gap-2 rounded-lg border border-border-color bg-surface p-4">
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Location name"
                className="rounded-md border border-border-color px-3 py-2 text-sm"
              />
              <input
                value={editForm.address}
                onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Address"
                className="rounded-md border border-border-color px-3 py-2 text-sm"
              />
              <input
                value={editForm.phone}
                onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone (optional)"
                className="rounded-md border border-border-color px-3 py-2 text-sm"
              />
              <input
                value={editForm.hours}
                onChange={(e) => setEditForm((prev) => ({ ...prev, hours: e.target.value }))}
                placeholder="Hours (optional)"
                className="rounded-md border border-border-color px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  disabled={isSavingEdit}
                  onClick={() => void handleSaveEdit(location.id)}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingId(null)} className="rounded-md border border-border-color px-3 py-1.5 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={location.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border-color bg-surface p-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">{location.name}</p>
                <p className="text-sm text-muted">{location.address}</p>
                {location.phone && <p className="text-sm text-muted">{location.phone}</p>}
                {location.hours && <p className="text-sm text-muted">{location.hours}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => startEdit(location)} className="rounded-md border border-border-color px-3 py-1 text-xs">
                  Edit
                </button>
                <button onClick={() => void handleRemove(location.id)} className="rounded-md border border-border-color px-3 py-1 text-xs">
                  Remove
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      {locations.length < MAX_LOCATIONS ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-color p-4">
          <p className="text-sm font-medium">Add a location</p>
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Location name (e.g. Downtown branch)"
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
          <input
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Address"
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Phone (optional)"
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
          <input
            value={form.hours}
            onChange={(e) => setForm((prev) => ({ ...prev, hours: e.target.value }))}
            placeholder="Hours (optional)"
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
          <button
            disabled={isAdding || !form.name.trim() || !form.address.trim()}
            onClick={() => void handleAdd()}
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {isAdding ? 'Adding…' : 'Add location'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">Maximum of {MAX_LOCATIONS} locations reached.</p>
      )}
    </>
  );
}

export default function LocationsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <LocationsContent />
    </ProtectedRoute>
  );
}

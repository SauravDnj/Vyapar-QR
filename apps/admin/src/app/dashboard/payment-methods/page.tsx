'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { useAuth } from '../../../context/auth-context';
import { getOnboardingStatus, savePaymentMethods, uploadImage, type OnboardingPaymentMethod } from '../../../lib/onboarding-api';

import type { PaymentMethodType } from '@qrhub/types';

const APPS: { type: PaymentMethodType; label: string }[] = [
  { type: 'gpay', label: 'GPay' },
  { type: 'phonepe', label: 'PhonePe' },
  { type: 'paytm', label: 'Paytm' },
];

interface Row {
  qrImageUrl: string;
  upiId: string;
}

function PaymentMethodsContent() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<Record<PaymentMethodType, Row>>({
    gpay: { qrImageUrl: '', upiId: '' },
    phonepe: { qrImageUrl: '', upiId: '' },
    paytm: { qrImageUrl: '', upiId: '' },
    other: { qrImageUrl: '', upiId: '' },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const status = await getOnboardingStatus(accessToken);
      setRows((prev) => {
        const next = { ...prev };
        for (const method of status.paymentMethods as OnboardingPaymentMethod[]) {
          if (method.type in next) {
            next[method.type] = { qrImageUrl: method.qrImageUrl ?? '', upiId: method.upiId ?? '' };
          }
        }
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleUpload(type: PaymentMethodType, file: File) {
    if (!accessToken) return;
    try {
      const url = await uploadImage(accessToken, file);
      setRows((prev) => ({ ...prev, [type]: { ...prev[type], qrImageUrl: url } }));
    } catch {
      setMessage('Upload failed.');
    }
  }

  async function handleSave() {
    if (!accessToken) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const methods = APPS.filter(({ type }) => rows[type].qrImageUrl || rows[type].upiId).map(({ type }) => ({
        type,
        qrImageUrl: rows[type].qrImageUrl || undefined,
        upiId: rows[type].upiId || undefined,
      }));
      await savePaymentMethods(accessToken, methods);
      setMessage('Saved.');
    } catch {
      setMessage('Failed to save — add at least one QR image or UPI ID.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Payment methods</h1>
      <p className="text-sm text-muted">The no-gateway payment setup — one card per app.</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {APPS.map(({ type, label }) => {
          const row = rows[type];
          const isConnected = Boolean(row.qrImageUrl || row.upiId);
          return (
            <div key={type} className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between">
                <p className="font-medium">{label}</p>
                <Badge tone={isConnected ? 'success' : 'neutral'}>{isConnected ? 'Connected' : 'Not set up'}</Badge>
              </div>

              {row.qrImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.qrImageUrl} alt={`${label} QR`} className="h-32 w-32 self-center object-contain" />
              ) : (
                <label className="flex h-32 cursor-pointer items-center justify-center rounded-md border border-dashed border-border-color text-center text-xs text-muted">
                  Drop QR image here
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleUpload(type, file);
                    }}
                  />
                </label>
              )}

              <label className="flex flex-col gap-1 text-sm">
                UPI ID (optional)
                <input
                  placeholder="business@okhdfcbank"
                  value={row.upiId}
                  onChange={(event) => setRows((prev) => ({ ...prev, [type]: { ...prev[type], upiId: event.target.value } }))}
                  className="rounded-md border border-border-color px-3 py-2 text-sm"
                />
                <span className="text-xs text-muted">Adding this enables true one-tap pay instead of scan-only.</span>
              </label>
            </div>
          );
        })}
      </div>

      {message && <p className="text-sm">{message}</p>}
      <button
        disabled={isSaving}
        onClick={() => void handleSave()}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Save changes'}
      </button>
    </>
  );
}

export default function PaymentMethodsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <PaymentMethodsContent />
    </ProtectedRoute>
  );
}

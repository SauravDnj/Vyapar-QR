'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { useAuth } from '../../../context/auth-context';
import { getOnboardingStatus, savePaymentMethods, uploadImage, type OnboardingPaymentMethod } from '../../../lib/onboarding-api';
import { normaliseUpiId, readUpiQr, type QrReading } from '../../../lib/read-upi-qr';

import type { PaymentMethodType } from '@vyaparqr/types';

const APPS: { type: PaymentMethodType; label: string; hint: string }[] = [
  { type: 'gpay', label: 'GPay', hint: 'Opens Google Pay directly.' },
  { type: 'phonepe', label: 'PhonePe', hint: 'Opens PhonePe directly.' },
  { type: 'paytm', label: 'Paytm', hint: 'Opens Paytm directly.' },
  {
    type: 'other',
    label: 'Any UPI app',
    // The three above deep-link into one named app. This one uses the plain
    // `upi://` scheme, so the phone itself lists every UPI app installed —
    // BHIM, Amazon Pay, CRED, a bank's own app — and the customer picks.
    hint: 'Lets the customer choose from every UPI app on their phone (BHIM, Amazon Pay, bank apps).',
  },
];

interface Row {
  qrImageUrl: string;
  upiId: string;
}

/** `checking` while the image is being read; absent when there is no image. */
type QrCheck = QrReading | { kind: 'checking' };

const EMPTY_ROW: Row = { qrImageUrl: '', upiId: '' };

/** The QR's UPI ID when it disagrees with the typed one, else null. */
function mismatchOf(row: Row, check: QrCheck | undefined): string | null {
  if (check?.kind !== 'upi' || !row.upiId.trim()) return null;
  return normaliseUpiId(row.upiId) === check.upiId ? null : check.upiId;
}

type AccountType = 'personal' | 'merchant';

/**
 * The account type to save: read from the QR when the QR is for this very UPI
 * ID; otherwise what was saved before, if the ID and image are untouched
 * (e.g. the image couldn't be fetched this time); otherwise unknown.
 */
function accountTypeFor(row: Row, check: QrCheck | undefined, saved: SavedMethod | undefined): AccountType | undefined {
  if (!row.upiId.trim()) return undefined;
  if (check?.kind === 'upi') {
    return normaliseUpiId(row.upiId) === check.upiId ? check.accountType : undefined;
  }
  if (saved && saved.upiId === row.upiId && saved.qrImageUrl === row.qrImageUrl) {
    return saved.upiAccountType ?? undefined;
  }
  return undefined;
}

interface SavedMethod extends Row {
  upiAccountType: AccountType | null;
}

function QrNotice({
  row,
  check,
  autoFilled,
  onUseQrId,
}: {
  row: Row;
  check: QrCheck | undefined;
  autoFilled: boolean;
  onUseQrId: (upiId: string) => void;
}) {
  if (!check || !row.qrImageUrl) return null;

  if (check.kind === 'checking') {
    return <p className="text-xs text-muted">Reading the QR…</p>;
  }

  if (check.kind === 'no-qr') {
    return (
      <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
        This image has no QR code we can read. Upload the payment QR from your UPI app (Profile → My QR), not a photo
        or document.
      </p>
    );
  }

  if (check.kind === 'not-upi') {
    return (
      <p role="alert" className="rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
        This QR code isn&apos;t a UPI payment QR, so customers can&apos;t pay by scanning it.
      </p>
    );
  }

  if (check.kind === 'unreadable') {
    return <p className="text-xs text-muted">Couldn&apos;t check this image. Make sure the UPI ID below is right.</p>;
  }

  const mismatch = mismatchOf(row, check);
  if (mismatch) {
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
        <p>
          Your QR pays <span className="font-mono font-semibold">{mismatch}</span>, but the UPI ID below is{' '}
          <span className="font-mono font-semibold">{normaliseUpiId(row.upiId)}</span>. The Pay button uses the UPI ID,
          so if it&apos;s wrong, customers see &ldquo;Receiver&apos;s UPI ID is not available&rdquo;.
        </p>
        <button
          type="button"
          onClick={() => {
            onUseQrId(mismatch);
          }}
          className="w-fit cursor-pointer rounded-md border border-current px-2.5 py-1 font-medium"
        >
          Use {mismatch}
        </button>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-success">
        {autoFilled ? 'UPI ID filled in from your QR — save to apply.' : 'UPI ID matches your QR.'}
        {check.payeeName ? ` Pays “${check.payeeName}”.` : ''}
        {check.accountType === 'merchant' ? ' Business account — one-tap Pay works.' : ''}
      </p>
      {check.accountType === 'personal' ? (
        <div role="alert" className="flex flex-col gap-1.5 rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
          <p className="font-semibold">This is a personal UPI ID.</p>
          <p>
            Google Pay, PhonePe and banks block payments to personal IDs that start from a website — customers see
            &ldquo;exceeded the bank limit&rdquo; or &ldquo;declined for security reasons&rdquo;, whatever the amount.
            Until you switch, your page asks customers to copy your UPI ID and pay it inside their app, which works.
          </p>
          <p>
            For one-tap Pay, get a free business UPI QR from PhonePe Business, Google Pay for Business, Paytm for
            Business or BharatPe, and upload it here.
          </p>
        </div>
      ) : null}
    </>
  );
}

function PaymentMethodsContent() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<Record<PaymentMethodType, Row>>({
    gpay: EMPTY_ROW,
    phonepe: EMPTY_ROW,
    paytm: EMPTY_ROW,
    other: EMPTY_ROW,
  });
  const [checks, setChecks] = useState<Partial<Record<PaymentMethodType, QrCheck>>>({});
  const [autoFilled, setAutoFilled] = useState<Partial<Record<PaymentMethodType, boolean>>>({});
  const [saved, setSaved] = useState<Partial<Record<PaymentMethodType, SavedMethod>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** Latest rows, for the async QR read to see what was typed meanwhile. */
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  /** Reads the QR and, when the UPI ID field is empty, fills it from the QR. */
  const checkQr = useCallback(async (type: PaymentMethodType, source: Blob | string) => {
    setChecks((prev) => ({ ...prev, [type]: { kind: 'checking' } }));
    const reading = await readUpiQr(source);
    setChecks((prev) => ({ ...prev, [type]: reading }));
    if (reading.kind !== 'upi' || rowsRef.current[type].upiId.trim()) return;
    setRows((prev) => ({ ...prev, [type]: { ...prev[type], upiId: reading.upiId } }));
    setAutoFilled((filled) => ({ ...filled, [type]: true }));
  }, []);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const status = await getOnboardingStatus(accessToken);
      const loaded: Partial<Record<PaymentMethodType, Row>> = {};
      const savedMethods: Partial<Record<PaymentMethodType, SavedMethod>> = {};
      for (const method of status.paymentMethods as OnboardingPaymentMethod[]) {
        const row = { qrImageUrl: method.qrImageUrl ?? '', upiId: method.upiId ?? '' };
        loaded[method.type] = row;
        savedMethods[method.type] = { ...row, upiAccountType: method.upiAccountType ?? null };
      }
      setRows((prev) => ({ ...prev, ...loaded }));
      setSaved(savedMethods);
      // Check what is already saved too — a wrong ID typed before this check
      // existed is exactly the case it was built for.
      for (const [type, row] of Object.entries(loaded) as [PaymentMethodType, Row][]) {
        if (row.qrImageUrl) void checkQr(type, row.qrImageUrl);
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, checkQr]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  function updateRow(type: PaymentMethodType, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
    setConfirmMismatch(false);
  }

  async function handleUpload(type: PaymentMethodType, file: File) {
    if (!accessToken) return;
    // Read the picked file locally while it uploads — no round trip needed.
    void checkQr(type, file);
    try {
      const url = await uploadImage(accessToken, file);
      updateRow(type, { qrImageUrl: url });
    } catch {
      setChecks((prev) => ({ ...prev, [type]: undefined }));
      setMessage('Upload failed.');
    }
  }

  function removeImage(type: PaymentMethodType) {
    updateRow(type, { qrImageUrl: '' });
    setChecks((prev) => ({ ...prev, [type]: undefined }));
    setAutoFilled((prev) => ({ ...prev, [type]: false }));
  }

  const mismatched = APPS.filter(({ type }) => mismatchOf(rows[type], checks[type]));

  async function handleSave() {
    if (!accessToken) return;
    if (mismatched.length > 0 && !confirmMismatch) {
      setConfirmMismatch(true);
      setMessage(
        `${mismatched.map((app) => app.label).join(', ')}: the UPI ID doesn't match the uploaded QR. Fix it, or press Save again to keep it.`,
      );
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const methods = APPS.filter(({ type }) => rows[type].qrImageUrl || rows[type].upiId).map(({ type }) => ({
        type,
        qrImageUrl: rows[type].qrImageUrl || undefined,
        upiId: rows[type].upiId ? normaliseUpiId(rows[type].upiId) : undefined,
        upiAccountType: accountTypeFor(rows[type], checks[type], saved[type]),
      }));
      await savePaymentMethods(accessToken, methods);
      setSaved(
        Object.fromEntries(
          methods.map((m) => [
            m.type,
            { qrImageUrl: m.qrImageUrl ?? '', upiId: m.upiId ?? '', upiAccountType: m.upiAccountType ?? null },
          ]),
        ),
      );
      setAutoFilled({});
      setConfirmMismatch(false);
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
      <p className="text-sm text-muted">
        The no-gateway payment setup — one card per app. Upload the QR from your UPI app and we&apos;ll read the UPI ID
        from it.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {APPS.map(({ type, label, hint }) => {
          const row = rows[type];
          const check = checks[type];
          const isConnected = Boolean(row.qrImageUrl || row.upiId);
          const hasProblem =
            Boolean(mismatchOf(row, check)) || check?.kind === 'no-qr' || check?.kind === 'not-upi';
          const isPersonal = accountTypeFor(row, check, saved[type]) === 'personal';
          const fileInput = (
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(type, file);
                event.target.value = '';
              }}
            />
          );
          return (
            <div key={type} className="flex flex-col gap-3 rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between">
                <p className="font-medium">{label}</p>
                <Badge tone={hasProblem || isPersonal ? 'warning' : isConnected ? 'success' : 'neutral'}>
                  {hasProblem ? 'Check this' : isPersonal ? 'Personal ID' : isConnected ? 'Connected' : 'Not set up'}
                </Badge>
              </div>
              <p className="text-xs text-muted">{hint}</p>

              {row.qrImageUrl ? (
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.qrImageUrl} alt={`${label} QR`} className="h-32 w-32 object-contain" />
                  <div className="flex gap-3 text-xs">
                    <label className="cursor-pointer text-accent underline underline-offset-2">
                      Replace
                      {fileInput}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        removeImage(type);
                      }}
                      className="cursor-pointer text-muted underline underline-offset-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex h-32 cursor-pointer items-center justify-center rounded-md border border-dashed border-border-color text-center text-xs text-muted">
                  Drop QR image here
                  {fileInput}
                </label>
              )}

              <QrNotice
                row={row}
                check={check}
                autoFilled={Boolean(autoFilled[type])}
                onUseQrId={(upiId) => {
                  updateRow(type, { upiId });
                }}
              />

              <label className="flex flex-col gap-1 text-sm">
                UPI ID (optional)
                <input
                  placeholder="business@okhdfcbank"
                  value={row.upiId}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setAutoFilled((prev) => ({ ...prev, [type]: false }));
                    updateRow(type, { upiId: event.target.value });
                  }}
                  className="rounded-md border border-border-color px-3 py-2 font-mono text-sm"
                />
                <span className="text-xs text-muted">
                  Any format your UPI app shows — phone@ybl, name@okhdfcbank, name.surname@oksbi. It enables one-tap pay.
                </span>
              </label>
            </div>
          );
        })}
      </div>

      {message && <p className={`text-sm ${confirmMismatch ? 'text-warning' : ''}`}>{message}</p>}
      <button
        disabled={isSaving}
        onClick={() => void handleSave()}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : confirmMismatch ? 'Save anyway' : 'Save changes'}
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

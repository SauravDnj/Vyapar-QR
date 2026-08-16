'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import {
  createAdditionalQrCode,
  createBulkQrCodes,
  deleteAdditionalQrCode,
  getPrintSheetPdf,
  getQrScanTrend,
  listAdditionalQrCodes,
  restyleAdditionalQrCode,
  setQrRedirectSettings,
  type AdditionalQrCode,
} from '../../../lib/qr-api';

async function downloadFile(url: string, filename: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

function ScanTrend({ accessToken, id }: { accessToken: string; id: string }) {
  const [trend, setTrend] = useState<{ date: string; count: number }[] | null>(null);

  useEffect(() => {
    void (async () => {
      setTrend(await getQrScanTrend(accessToken, id));
    })();
  }, [accessToken, id]);

  if (!trend) {
    return <p className="text-xs text-muted">Loading trend…</p>;
  }

  const max = Math.max(1, ...trend.map((point) => point.count));

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted">Scans, last 30 days</p>
      <div className="flex h-10 items-end gap-px">
        {trend.map((point) => (
          <div
            key={point.date}
            title={`${point.date}: ${String(point.count)}`}
            className="flex-1 rounded-t-sm bg-accent/60"
            style={{ height: `${String(Math.max(4, (point.count / max) * 100))}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function QrCard({
  accessToken,
  qr,
  onRestyle,
  onDelete,
  onRedirectSaved,
  isRestyling,
}: {
  accessToken: string;
  qr: AdditionalQrCode;
  onRestyle: (id: string, style: { foregroundColor?: string; backgroundColor?: string; logoEnabled?: boolean }) => void;
  onDelete: (id: string) => void;
  onRedirectSaved: (updated: AdditionalQrCode) => void;
  isRestyling: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState(qr.redirectUrl ?? '');
  const [expiresAt, setExpiresAt] = useState(qr.expiresAt ? qr.expiresAt.slice(0, 10) : '');
  const [maxScans, setMaxScans] = useState(qr.maxScans ? String(qr.maxScans) : '');
  const [isSavingRedirect, setIsSavingRedirect] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState<string | null>(null);

  async function handleSaveRedirect() {
    setIsSavingRedirect(true);
    setRedirectMessage(null);
    try {
      const updated = await setQrRedirectSettings(accessToken, qr.id, {
        redirectUrl,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : '',
        maxScans: maxScans ? Number(maxScans) : 0,
      });
      onRedirectSaved(updated);
      setRedirectMessage('Saved.');
    } catch {
      setRedirectMessage('Failed to save — check the redirect URL starts with http:// or https://');
    } finally {
      setIsSavingRedirect(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <p className="font-medium">{qr.label}</p>
      {qr.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr.imageUrl} alt={`${qr.label ?? 'Promo'} QR`} className="h-32 w-32 self-center object-contain" />
      )}
      <p className="text-xs text-muted">Scans: {qr.scanCount}</p>
      {qr.redirectUrl ? <p className="text-xs text-accent">Smart redirect active → {qr.redirectUrl}</p> : null}
      {qr.expiresAt ? <p className="text-xs text-muted">Expires {new Date(qr.expiresAt).toLocaleDateString()}</p> : null}
      {qr.maxScans ? <p className="text-xs text-muted">Scan limit: {qr.maxScans}</p> : null}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          Color
          <input
            type="color"
            value={qr.foregroundColor ?? '#000000'}
            onChange={(e) => {
              onRestyle(qr.id, { foregroundColor: e.target.value });
            }}
            disabled={isRestyling}
            className="h-6 w-6 cursor-pointer rounded border border-border-color bg-transparent p-0"
          />
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={qr.logoEnabled}
            onChange={(e) => {
              onRestyle(qr.id, { logoEnabled: e.target.checked });
            }}
            disabled={isRestyling}
          />
          Logo (SVG)
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {qr.imageUrl && (
          <button
            onClick={() => void downloadFile(qr.imageUrl!, `${qr.label ?? 'promo'}-qr.png`)}
            className="rounded-md border border-border-color px-3 py-1 text-xs"
          >
            PNG
          </button>
        )}
        {qr.svgImageUrl && (
          <button
            onClick={() => void downloadFile(qr.svgImageUrl!, `${qr.label ?? 'promo'}-qr.svg`)}
            className="rounded-md border border-border-color px-3 py-1 text-xs"
          >
            SVG
          </button>
        )}
        <button onClick={() => setShowAdvanced((prev) => !prev)} className="rounded-md border border-border-color px-3 py-1 text-xs">
          {showAdvanced ? 'Hide advanced' : 'Advanced'}
        </button>
        <button onClick={() => onDelete(qr.id)} className="rounded-md border border-border-color px-3 py-1 text-xs">
          Delete
        </button>
      </div>

      {showAdvanced ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border-color p-3">
          <ScanTrend accessToken={accessToken} id={qr.id} />
          <label className="flex flex-col gap-1 text-xs">
            Smart redirect — send scans here instead of your page
            <input
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://wa.me/... or any URL (blank = your landing page)"
              className="rounded-md border border-border-color px-2 py-1.5 text-xs"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs">
              Expires
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="rounded-md border border-border-color px-2 py-1.5 text-xs"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs">
              Scan limit
              <input
                type="number"
                min={0}
                value={maxScans}
                onChange={(e) => setMaxScans(e.target.value)}
                placeholder="No limit"
                className="rounded-md border border-border-color px-2 py-1.5 text-xs"
              />
            </label>
          </div>
          <button
            disabled={isSavingRedirect}
            onClick={() => void handleSaveRedirect()}
            className="w-fit rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
          >
            {isSavingRedirect ? 'Saving…' : 'Save advanced settings'}
          </button>
          {redirectMessage && <p className="text-xs text-muted">{redirectMessage}</p>}
        </div>
      ) : null}
    </div>
  );
}

function QrCodesContent() {
  const { accessToken } = useAuth();
  const [qrCodes, setQrCodes] = useState<AdditionalQrCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [bulkLabels, setBulkLabels] = useState('');
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [isDownloadingSheet, setIsDownloadingSheet] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [restylingId, setRestylingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      setQrCodes(await listAdditionalQrCodes(accessToken));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleCreate() {
    if (!accessToken || !label.trim()) return;
    setIsCreating(true);
    setMessage(null);
    try {
      const created = await createAdditionalQrCode(accessToken, label.trim());
      setQrCodes((prev) => [...prev, created]);
      setLabel('');
    } catch {
      setMessage('Failed to create QR code.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleBulkCreate() {
    if (!accessToken) return;
    const labels = bulkLabels
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (labels.length === 0) return;

    setIsBulkCreating(true);
    setMessage(null);
    try {
      const created = await createBulkQrCodes(accessToken, labels);
      setQrCodes((prev) => [...prev, ...created]);
      setBulkLabels('');
    } catch {
      setMessage('Failed to create QR codes.');
    } finally {
      setIsBulkCreating(false);
    }
  }

  async function handleDownloadSheet() {
    if (!accessToken) return;
    setIsDownloadingSheet(true);
    setMessage(null);
    try {
      const blob = await getPrintSheetPdf(accessToken);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'qr-codes.pdf';
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setMessage('Failed to generate the print sheet — create at least one QR code first.');
    } finally {
      setIsDownloadingSheet(false);
    }
  }

  async function handleRestyle(id: string, style: { foregroundColor?: string; backgroundColor?: string; logoEnabled?: boolean }) {
    if (!accessToken) return;
    setRestylingId(id);
    setMessage(null);
    try {
      const updated = await restyleAdditionalQrCode(accessToken, id, style);
      setQrCodes((prev) => prev.map((qr) => (qr.id === id ? updated : qr)));
    } catch {
      setMessage('Failed to update style.');
    } finally {
      setRestylingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return;
    setQrCodes((prev) => prev.filter((qr) => qr.id !== id));
    try {
      await deleteAdditionalQrCode(accessToken, id);
    } catch {
      setMessage('Failed to delete QR code.');
      await refresh();
    }
  }

  if (isLoading || !accessToken) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Promo QR codes</h1>
      <p className="text-sm text-muted">
        Create extra QR codes for table tents, flyers, or individual locations — each one tracks its own scan count
        separately from your main QR code. By default they point to your landing page, or set an advanced smart
        redirect to send scans anywhere else instead.
      </p>
      {message && <p className="text-sm text-danger">{message}</p>}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border-color p-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Label
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Table 5, Downtown flyer"
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <button
          disabled={isCreating || !label.trim()}
          onClick={() => void handleCreate()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {isCreating ? 'Creating…' : 'Create QR code'}
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-color p-4">
        <p className="text-sm font-medium">Bulk create</p>
        <p className="text-xs text-muted">One label per line — e.g. for a set of table QR codes.</p>
        <textarea
          value={bulkLabels}
          onChange={(e) => setBulkLabels(e.target.value)}
          rows={3}
          placeholder={'Table 1\nTable 2\nTable 3'}
          className="rounded-md border border-border-color px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            disabled={isBulkCreating || !bulkLabels.trim()}
            onClick={() => void handleBulkCreate()}
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {isBulkCreating ? 'Creating…' : 'Create all'}
          </button>
          <button
            disabled={isDownloadingSheet || qrCodes.length === 0}
            onClick={() => void handleDownloadSheet()}
            className="w-fit rounded-md border border-border-color px-4 py-2 text-sm disabled:opacity-50"
          >
            {isDownloadingSheet ? 'Generating…' : 'Download printable sheet'}
          </button>
        </div>
      </div>

      {qrCodes.length === 0 ? (
        <p className="text-sm text-muted">No promo QR codes yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {qrCodes.map((qr) => (
            <QrCard
              key={qr.id}
              accessToken={accessToken}
              qr={qr}
              onRestyle={(id, style) => void handleRestyle(id, style)}
              onDelete={(id) => void handleDelete(id)}
              onRedirectSaved={(updated) => setQrCodes((prev) => prev.map((existing) => (existing.id === updated.id ? updated : existing)))}
              isRestyling={restylingId === qr.id}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function QrCodesPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <QrCodesContent />
    </ProtectedRoute>
  );
}

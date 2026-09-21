'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge, type BadgeTone } from '../../../components/ui/badge';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  downloadInvoicePdf,
  getCurrentSubscription,
  listInvoices,
  type Invoice,
  type Subscription,
} from '../../../lib/billing-api';

/** What each plan flag unlocks, in the owner's words. */
const INCLUDES: { label: string; on: (sub: Subscription) => boolean }[] = [
  { label: 'Analytics dashboard', on: (sub) => Boolean(sub.plan.featuresJson?.analytics) },
  { label: 'Your own domain name', on: (sub) => sub.plan.customDomainAllowed },
  { label: 'No “Powered by Vyapar QR” on your page', on: (sub) => Boolean(sub.plan.featuresJson?.whiteLabel) },
  { label: 'Digital menu and WhatsApp ordering', on: (sub) => Boolean(sub.plan.featuresJson?.digitalMenu) },
];

const INVOICE_STATUS_TONE: Record<Invoice['status'], BadgeTone> = {
  paid: 'success',
  pending: 'warning',
  failed: 'danger',
};

async function downloadBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

function BillingContent() {
  const { accessToken } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [sub, invoiceList] = await Promise.all([getCurrentSubscription(accessToken), listInvoices(accessToken)]);
      setSubscription(sub);
      setInvoices(invoiceList);
    } catch {
      setMessage('Failed to load billing info.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleDownloadInvoice(invoice: Invoice) {
    if (!accessToken) return;
    setDownloadingId(invoice.id);
    try {
      const blob = await downloadInvoicePdf(accessToken, invoice.id);
      await downloadBlob(blob, `invoice-${invoice.id.slice(0, 8)}.pdf`);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to download invoice.');
    } finally {
      setDownloadingId(null);
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Billing</h1>
      {message && <p className="text-sm text-danger">{message}</p>}

      {/* Plans are assigned by the Vyapar QR team, not bought here. This page
          used to list every plan with a "Switch to this plan" button that
          started a Razorpay checkout; the plan is now shown, not sold. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Your plan</h2>
        {subscription?.status === 'active' ? (
          <div
            className="flex w-fit min-w-72 flex-col gap-3 rounded-lg border border-accent bg-surface p-5"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-lg font-semibold">{subscription.plan.name}</p>
              <Badge tone="success">active</Badge>
            </div>
            {Number(subscription.plan.price) > 0 ? (
              <p className="font-mono text-2xl font-semibold tabular-nums">
                ₹{Number(subscription.plan.price).toLocaleString('en-IN')}
                <span className="text-sm font-normal text-muted">/{subscription.plan.billingCycle}</span>
              </p>
            ) : null}
            <ul className="flex flex-col gap-1.5 text-sm">
              {INCLUDES.map(({ label, on }) => (
                <li key={label} className={on(subscription) ? '' : 'text-muted line-through'}>
                  {on(subscription) ? '✓' : '—'} {label}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted">
            You don’t have an active plan right now{subscription ? ` (your ${subscription.plan.name} plan is ${subscription.status})` : ''}.
          </p>
        )}
        <p className="max-w-lg text-sm text-muted">
          Your plan is set up for you by the Vyapar QR team. To change it, or to add a feature, get in touch with us.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Invoice history</h2>
        {invoices.length === 0 ? (
          <p className="text-muted">No invoices yet.</p>
        ) : (
          <div className="w-fit overflow-x-auto rounded-lg border border-border-color bg-surface" style={{ boxShadow: 'var(--shadow-card)' }}>
            <table className="text-left text-sm">
              <thead>
                <tr className="border-b border-border-color font-mono text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border-color last:border-0">
                    <td className="px-4 py-3">{new Date(invoice.issuedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono">₹{invoice.amount}</td>
                    <td className="px-4 py-3">
                      <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={downloadingId === invoice.id}
                        onClick={() => void handleDownloadInvoice(invoice)}
                        className="rounded-md border border-border-color px-2.5 py-1 text-xs disabled:opacity-50"
                      >
                        {downloadingId === invoice.id ? 'Downloading…' : 'Download PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function BillingPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <BillingContent />
    </ProtectedRoute>
  );
}

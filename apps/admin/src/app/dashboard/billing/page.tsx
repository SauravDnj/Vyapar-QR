'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge, type BadgeTone } from '../../../components/ui/badge';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  checkout,
  downloadInvoicePdf,
  getCurrentSubscription,
  listAvailablePlans,
  listInvoices,
  type BillingPlan,
  type Invoice,
  type Subscription,
} from '../../../lib/billing-api';

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
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [sub, planList, invoiceList] = await Promise.all([
        getCurrentSubscription(accessToken),
        listAvailablePlans(accessToken),
        listInvoices(accessToken),
      ]);
      setSubscription(sub);
      setPlans(planList);
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

  async function handleSwitchPlan(planId: string) {
    if (!accessToken) return;
    setMessage(null);
    try {
      const result = await checkout(accessToken, planId);
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      }
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to start checkout.');
    }
  }

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

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Current plan</h2>
        {subscription ? (
          <div
            className="flex w-fit min-w-72 flex-col gap-2 rounded-lg border border-accent bg-surface p-5"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-lg font-semibold">{subscription.plan.name}</p>
              <Badge tone={subscription.status === 'active' ? 'success' : 'warning'}>{subscription.status}</Badge>
            </div>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              ₹{subscription.plan.price}
              <span className="text-sm font-normal text-muted">/{subscription.plan.billingCycle}</span>
            </p>
            {subscription.currentPeriodEnd && (
              <p className="text-sm text-muted">Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
            )}
          </div>
        ) : (
          <p className="text-muted">No active subscription.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Available plans</h2>
        <div className="flex flex-wrap gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex w-56 flex-col gap-2 rounded-lg border border-border-color bg-surface p-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <p className="font-medium">{plan.name}</p>
              <p className="font-mono text-sm text-muted">
                ₹{plan.price}/{plan.billingCycle}
              </p>
              <p className="text-xs text-muted">Up to {plan.maxThemes} themes</p>
              <button
                onClick={() => void handleSwitchPlan(plan.id)}
                disabled={subscription?.plan.id === plan.id}
                className="mt-2 w-fit rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-40"
              >
                {subscription?.plan.id === plan.id ? 'Current plan' : 'Switch to this plan'}
              </button>
            </div>
          ))}
        </div>
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

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { StatCard } from '../../../components/ui/stat-card';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  downloadPaymentsCsv,
  getPaymentSummary,
  listPayments,
  setPaymentStatus,
  type PaymentClaim,
  type PaymentClaimStatus,
  type PaymentMethodType,
  type PaymentSummary,
} from '../../../lib/payments-api';

import type { BadgeTone } from '../../../components/ui/badge';

const METHOD_LABEL: Record<PaymentMethodType, string> = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  other: 'Any UPI app',
};

const STATUS_LABEL: Record<PaymentClaimStatus, string> = {
  claimed: 'Says paid',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<PaymentClaimStatus, BadgeTone> = {
  claimed: 'warning',
  confirmed: 'success',
  cancelled: 'neutral',
};

const FILTERS: { value: PaymentClaimStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'claimed', label: 'To check' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function rupees(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function PaymentsContent() {
  const { accessToken } = useAuth();
  const [payments, setPayments] = useState<PaymentClaim[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [filter, setFilter] = useState<PaymentClaimStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [rows, totals] = await Promise.all([
        listPayments(accessToken, filter === 'all' ? undefined : filter),
        getPaymentSummary(accessToken),
      ]);
      setPayments(rows);
      setSummary(totals);
    } catch {
      setMessage('Failed to load payments.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, filter]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleStatus(id: string, status: PaymentClaimStatus) {
    if (!accessToken) return;
    setMessage(null);
    try {
      await setPaymentStatus(accessToken, id, status);
      await refresh();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to update.');
    }
  }

  async function handleExport() {
    if (!accessToken) return;
    try {
      const blob = await downloadPaymentsCsv(accessToken);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'payments.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to export payments.');
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payments</h1>
          <p className="text-sm text-muted">
            Every UPI payment a customer said they made on your page. Money goes straight to your
            UPI app, so check it there and mark each one confirmed.
          </p>
        </div>
        <button onClick={() => void handleExport()} className="rounded-md border border-border-color px-3 py-1.5 text-sm">
          Download for Excel
        </button>
      </div>

      {message && <p className="text-sm text-danger">{message}</p>}

      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Today" value={rupees(summary.todayTotal)} />
            <StatCard label="Last 7 days" value={rupees(summary.weekTotal)} />
            <StatCard label="Last 30 days" value={rupees(summary.monthTotal)} />
            <StatCard label="To check" value={String(summary.claimCount)} />
          </div>

          {summary.byMethod.length > 0 ? (
            <div
              className="flex flex-wrap gap-4 rounded-lg border border-border-color bg-surface p-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              {summary.byMethod.map((row) => (
                <div key={row.method} className="flex flex-col">
                  <span className="text-xs text-muted">{METHOD_LABEL[row.method]}</span>
                  <span className="font-medium">
                    {rupees(row.total)} <span className="text-xs text-muted">· {row.count}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-full border px-3 py-1 text-sm ${
              filter === option.value ? 'border-accent bg-accent/10 text-accent' : 'border-border-color'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {payments.length === 0 ? (
        <p className="text-muted">No payments yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-color bg-surface" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-color font-mono text-xs tracking-wide text-muted uppercase">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Paid with</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-border-color last:border-0">
                  <td className="px-4 py-3 font-mono text-muted">
                    {new Date(payment.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {payment.amount === null ? (
                      <span className="text-muted">Not stated</span>
                    ) : (
                      rupees(payment.amount)
                    )}
                  </td>
                  <td className="px-4 py-3">{METHOD_LABEL[payment.method]}</td>
                  <td className="px-4 py-3">
                    {payment.customerPhone ? (
                      <div className="flex flex-col">
                        <span>{payment.customerName ?? 'Customer'}</span>
                        <a href={`tel:${payment.customerPhone}`} className="font-mono text-xs hover:underline">
                          {payment.customerPhone}
                        </a>
                      </div>
                    ) : (
                      <span className="text-muted">Not given</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[payment.status]}>{STATUS_LABEL[payment.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {payment.status !== 'confirmed' ? (
                        <button
                          onClick={() => void handleStatus(payment.id, 'confirmed')}
                          className="rounded-md border border-border-color px-2.5 py-1 text-xs"
                        >
                          Got it
                        </button>
                      ) : null}
                      {payment.status !== 'cancelled' ? (
                        <button
                          onClick={() => void handleStatus(payment.id, 'cancelled')}
                          className="rounded-md border border-border-color px-2.5 py-1 text-xs text-muted"
                        >
                          Never came
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        A customer tapping Pay opens their own UPI app, so nothing here is a verified receipt — it
        is what the customer said they paid. Anyone who left a number is also in{' '}
        <Link href="/dashboard/leads" className="text-accent underline">
          Leads (CRM)
        </Link>
        .
      </p>
    </>
  );
}

export default function PaymentsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <PaymentsContent />
    </ProtectedRoute>
  );
}

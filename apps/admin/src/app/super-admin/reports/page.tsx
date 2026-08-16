'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { getBillingReport, type BillingReport } from '../../../lib/admin-api';

const MAX_REVENUE_BAR_HEIGHT = 120;

function RevenueChart({ months }: { months: BillingReport['revenueByMonth'] }) {
  const max = Math.max(1, ...months.map((month) => month.revenue));
  return (
    <div className="flex items-end gap-3" style={{ height: MAX_REVENUE_BAR_HEIGHT }}>
      {months.map((month) => (
        <div key={month.month} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs text-muted">₹{month.revenue.toLocaleString()}</span>
          <div
            className="w-full max-w-10 rounded-t bg-black"
            style={{ height: (month.revenue / max) * MAX_REVENUE_BAR_HEIGHT }}
          />
          <span className="text-xs text-muted">{month.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function ReportsContent() {
  const { accessToken } = useAuth();
  const [report, setReport] = useState<BillingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      setReport(await getBillingReport(accessToken));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Billing reports</h1>

      {isLoading || !report ? (
        <p>Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-6">
            <div className="rounded-md border border-border-color p-4">
              <p className="text-sm text-muted">MRR</p>
              <p className="text-2xl font-semibold">₹{report.mrr.toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-border-color p-4">
              <p className="text-sm text-muted">Active clients</p>
              <p className="text-2xl font-semibold">{report.activeClients}</p>
            </div>
            <div className="rounded-md border border-border-color p-4">
              <p className="text-sm text-muted">Suspended clients</p>
              <p className="text-2xl font-semibold">{report.suspendedClients}</p>
            </div>
            <div className="rounded-md border border-border-color p-4">
              <p className="text-sm text-muted">Churned subscriptions</p>
              <p className="text-2xl font-semibold">{report.churnedSubscriptions}</p>
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Paid revenue — last 6 months</h2>
            <RevenueChart months={report.revenueByMonth} />
          </section>
        </>
      )}
    </>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <ReportsContent />
    </ProtectedRoute>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  getDomainStatus,
  setDomain,
  verifyDomain,
  type DomainStatus,
} from '../../../lib/domains-api';

function isApexDomain(domain: string): boolean {
  return domain.split('.').length === 2;
}

function DomainContent() {
  const { accessToken } = useAuth();
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLocked(false);
    try {
      const result = await getDomainStatus(accessToken);
      setStatus(result);
      setDomainInput(result.customDomain ?? '');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setLocked(true);
      } else {
        setMessage('Failed to load domain settings.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleSave() {
    if (!accessToken || !domainInput.trim()) return;
    setIsSaving(true);
    setMessage(null);
    try {
      setStatus(await setDomain(accessToken, domainInput.trim()));
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to save domain.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleVerify() {
    if (!accessToken) return;
    setIsVerifying(true);
    setMessage(null);
    try {
      const result = await verifyDomain(accessToken);
      setMessage(
        result.verified
          ? 'Domain verified! Point your DNS at the target below to go live with SSL.'
          : (result.message ?? 'Not verified yet.'),
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to verify.');
    } finally {
      setIsVerifying(false);
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  if (locked) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Custom domain</h1>
        <div className="w-fit max-w-md rounded-md border border-warning bg-warning-bg p-4 text-sm text-warning">
          <p className="font-medium">Custom domains are a Business-plan feature.</p>
          <p className="mt-1">
            Upgrade from{' '}
            <a href="/dashboard/billing" className="underline">
              Billing
            </a>{' '}
            to point your own domain at your page.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Custom domain</h1>
      {message && <p className="text-sm text-muted">{message}</p>}

      <section className="flex max-w-md flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Your domain
          <input
            type="text"
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
            placeholder="shop.example.com"
            className="rounded-md border border-border-color px-3 py-2"
          />
        </label>
        <button
          disabled={isSaving || !domainInput.trim()}
          onClick={() => void handleSave()}
          className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save domain'}
        </button>
      </section>

      {status?.customDomain && (
        <section className="flex max-w-md flex-col gap-4 rounded-lg border border-border-color bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p className="text-sm">
            Ownership:{' '}
            <span className={status.verified ? 'font-medium text-success' : 'font-medium text-warning'}>
              {status.verified ? 'Verified' : 'Not verified yet'}
            </span>
          </p>

          {!status.verified && status.verificationRecord && (
            <div className="flex flex-col gap-1 text-sm text-muted">
              <p>1. Add this DNS TXT record at your domain registrar to prove ownership:</p>
              <code className="rounded-md bg-border-color/30 p-2 text-xs">
                {status.verificationRecord.host}.{status.customDomain} TXT &quot;{status.verificationRecord.value}&quot;
              </code>
            </div>
          )}

          {!status.verified && (
            <button
              disabled={isVerifying}
              onClick={() => void handleVerify()}
              className="w-fit rounded-md border border-border-color px-4 py-2 text-sm disabled:opacity-50"
            >
              {isVerifying ? 'Checking…' : 'Verify now'}
            </button>
          )}

          {status.verified && status.dnsTarget && (
            <div className="flex flex-col gap-1 text-sm text-muted">
              <p>2. Point your domain&apos;s traffic here — SSL is provisioned automatically once this resolves:</p>
              {isApexDomain(status.customDomain) ? (
                <code className="rounded-md bg-border-color/30 p-2 text-xs">
                  {status.customDomain} A {status.dnsTarget.apexA}
                </code>
              ) : (
                <code className="rounded-md bg-border-color/30 p-2 text-xs">
                  {status.customDomain} CNAME {status.dnsTarget.subdomainCname}
                </code>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function DomainPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin']}>
      <DomainContent />
    </ProtectedRoute>
  );
}

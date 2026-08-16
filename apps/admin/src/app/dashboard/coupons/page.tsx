'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { createCoupon, deleteCoupon, listCoupons, redeemCoupon, updateCoupon, type Coupon } from '../../../lib/coupons-api';

function CouponsContent() {
  const { accessToken } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountText, setDiscountText] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      setCoupons(await listCoupons(accessToken));
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
    if (!accessToken || !code.trim() || !description.trim() || !discountText.trim()) return;
    setIsCreating(true);
    setMessage(null);
    try {
      const created = await createCoupon(accessToken, {
        code: code.trim(),
        description: description.trim(),
        discountText: discountText.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      });
      setCoupons((prev) => [created, ...prev]);
      setCode('');
      setDescription('');
      setDiscountText('');
      setExpiresAt('');
      setMaxRedemptions('');
    } catch {
      setMessage('Failed to create coupon — the code may already be in use.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    if (!accessToken) return;
    setCoupons((prev) => prev.map((c) => (c.id === id ? { ...c, isActive } : c)));
    try {
      await updateCoupon(accessToken, id, { isActive });
    } catch {
      setMessage('Failed to update.');
      await refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return;
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteCoupon(accessToken, id);
    } catch {
      setMessage('Failed to delete.');
      await refresh();
    }
  }

  async function handleRedeem() {
    if (!accessToken || !redeemCode.trim()) return;
    setIsRedeeming(true);
    setRedeemMessage(null);
    try {
      const redeemed = await redeemCoupon(accessToken, redeemCode.trim());
      setRedeemMessage(`Valid — ${redeemed.discountText} (${redeemed.description})`);
      setCoupons((prev) => prev.map((c) => (c.id === redeemed.id ? redeemed : c)));
      setRedeemCode('');
    } catch (error) {
      setRedeemMessage(error instanceof Error ? error.message : 'Invalid code.');
    } finally {
      setIsRedeeming(false);
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Coupons</h1>
      <p className="text-sm text-muted">Redeemable discount codes — a customer shows the code, you verify it here at checkout.</p>
      {message && <p className="text-sm text-danger">{message}</p>}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border-color p-4">
        <label className="flex flex-col gap-1 text-sm">
          Code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SAVE10"
            className="w-32 rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. First-time customer offer"
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Discount
          <input
            value={discountText}
            onChange={(e) => setDiscountText(e.target.value)}
            placeholder="10% off"
            className="w-32 rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Expires (optional)
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Max uses (optional)
          <input
            type="number"
            min={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            className="w-24 rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <button
          disabled={isCreating || !code.trim() || !description.trim() || !discountText.trim()}
          onClick={() => void handleCreate()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {isCreating ? 'Creating…' : 'Create coupon'}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border-color bg-surface p-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Verify a code at checkout
          <input
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
            placeholder="Customer's code"
            className="rounded-md border border-border-color px-3 py-2 text-sm"
          />
        </label>
        <button
          disabled={isRedeeming || !redeemCode.trim()}
          onClick={() => void handleRedeem()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {isRedeeming ? 'Checking…' : 'Redeem'}
        </button>
        {redeemMessage && <p className="text-sm">{redeemMessage}</p>}
      </div>

      {coupons.length === 0 ? (
        <p className="text-sm text-muted">No coupons yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="flex items-center justify-between gap-3 rounded-lg border border-border-color bg-surface p-3 text-sm">
              <div>
                <p className="font-medium">
                  {coupon.code} — {coupon.discountText}
                </p>
                <p className="text-muted">
                  {coupon.description} · used {coupon.redemptionCount}
                  {coupon.maxRedemptions ? `/${String(coupon.maxRedemptions)}` : ''}
                  {coupon.expiresAt ? ` · expires ${new Date(coupon.expiresAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => void handleToggle(coupon.id, !coupon.isActive)}
                  className="rounded-md border border-border-color px-3 py-1 text-xs"
                >
                  {coupon.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => void handleDelete(coupon.id)} className="rounded-md border border-border-color px-3 py-1 text-xs">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function CouponsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <CouponsContent />
    </ProtectedRoute>
  );
}

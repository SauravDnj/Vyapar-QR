'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { archivePlan, createPlan, listPlans, updatePlan, type Plan } from '../../../lib/admin-api';

interface PlanFormState {
  name: string;
  price: string;
  billingCycle: 'monthly' | 'yearly';
  maxThemes: string;
  customDomainAllowed: boolean;
  analytics: boolean;
  whiteLabel: boolean;
  digitalMenu: boolean;
}

const EMPTY_FORM: PlanFormState = {
  name: '',
  price: '',
  billingCycle: 'monthly',
  maxThemes: '1',
  customDomainAllowed: false,
  analytics: false,
  whiteLabel: false,
  digitalMenu: false,
};

function PlansContent() {
  const { accessToken } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      setPlans(await listPlans(accessToken));
    } catch {
      setError('Failed to load plans.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setError(null);
    try {
      await createPlan(accessToken, {
        name: form.name,
        price: Number(form.price),
        billingCycle: form.billingCycle,
        maxThemes: Number(form.maxThemes),
        customDomainAllowed: form.customDomainAllowed,
        featuresJson: {
          analytics: form.analytics,
          customDomain: form.customDomainAllowed,
          whiteLabel: form.whiteLabel,
          digitalMenu: form.digitalMenu,
        },
      });
      setForm(EMPTY_FORM);
      await refresh();
    } catch {
      setError('Failed to create plan.');
    }
  }

  async function handleArchive(id: string) {
    if (!accessToken) return;
    try {
      await archivePlan(accessToken, id);
      await refresh();
    } catch {
      setError('Failed to archive plan.');
    }
  }

  async function handleUnarchive(id: string) {
    if (!accessToken) return;
    try {
      await updatePlan(accessToken, id, { isArchived: false });
      await refresh();
    } catch {
      setError('Failed to unarchive plan.');
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Plans</h1>

      {error && <p className="text-sm text-danger">{error}</p>}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-color">
              <th className="py-2">Name</th>
              <th>Price</th>
              <th>Cycle</th>
              <th>Max themes</th>
              <th>Custom domain</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-border-color">
                <td className="py-2">{plan.name}</td>
                <td>{plan.price}</td>
                <td>{plan.billingCycle}</td>
                <td>{plan.maxThemes}</td>
                <td>{plan.customDomainAllowed ? 'Yes' : 'No'}</td>
                <td>{plan.isArchived ? 'Archived' : 'Active'}</td>
                <td>
                  {plan.isArchived ? (
                    <button
                      onClick={() => void handleUnarchive(plan.id)}
                      className="rounded border border-border-color px-2 py-1"
                    >
                      Unarchive
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleArchive(plan.id)}
                      className="rounded border border-border-color px-2 py-1"
                    >
                      Archive
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="flex max-w-md flex-col gap-3 border-t border-border-color pt-6"
      >
        <h2 className="text-lg font-semibold">New plan</h2>
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded border border-border-color px-3 py-2"
        />
        <input
          required
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="rounded border border-border-color px-3 py-2"
        />
        <select
          value={form.billingCycle}
          onChange={(e) =>
            setForm({ ...form, billingCycle: e.target.value as 'monthly' | 'yearly' })
          }
          className="rounded border border-border-color px-3 py-2"
        >
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input
          required
          type="number"
          min="0"
          placeholder="Max themes"
          value={form.maxThemes}
          onChange={(e) => setForm({ ...form, maxThemes: e.target.value })}
          className="rounded border border-border-color px-3 py-2"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.analytics}
            onChange={(e) => setForm({ ...form, analytics: e.target.checked })}
          />
          Analytics access
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.customDomainAllowed}
            onChange={(e) => setForm({ ...form, customDomainAllowed: e.target.checked })}
          />
          Custom domain allowed
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.whiteLabel}
            onChange={(e) => setForm({ ...form, whiteLabel: e.target.checked })}
          />
          White-label (hide &quot;Powered by QRHub&quot;)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.digitalMenu}
            onChange={(e) => setForm({ ...form, digitalMenu: e.target.checked })}
          />
          Digital menu + WhatsApp ordering
        </label>
        <button type="submit" className="w-fit rounded-md bg-accent px-4 py-2 text-accent-foreground">
          Create plan
        </button>
      </form>
    </>
  );
}

export default function PlansPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <PlansContent />
    </ProtectedRoute>
  );
}

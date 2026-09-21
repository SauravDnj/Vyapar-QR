'use client';

import { useCallback, useEffect, useState } from 'react';

import { formatPrice } from '../../../components/client-plan-panel';
import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { useAuth } from '../../../context/auth-context';
import { archivePlan, createPlan, listPlans, updatePlan, type Plan, type PlanInput } from '../../../lib/admin-api';
import { ApiError } from '../../../lib/api-client';

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
  price: '0',
  billingCycle: 'monthly',
  maxThemes: '1',
  customDomainAllowed: false,
  analytics: false,
  whiteLabel: false,
  digitalMenu: false,
};

const FEATURES: { key: 'analytics' | 'customDomainAllowed' | 'whiteLabel' | 'digitalMenu'; label: string }[] = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'customDomainAllowed', label: 'Custom domain' },
  { key: 'whiteLabel', label: 'White-label (hide “Powered by Vyapar QR”)' },
  { key: 'digitalMenu', label: 'Digital menu + WhatsApp ordering' },
];

function toForm(plan: Plan): PlanFormState {
  return {
    name: plan.name,
    price: String(Number(plan.price)),
    billingCycle: plan.billingCycle,
    maxThemes: String(plan.maxThemes),
    customDomainAllowed: plan.customDomainAllowed,
    analytics: plan.featuresJson.analytics,
    whiteLabel: plan.featuresJson.whiteLabel,
    digitalMenu: plan.featuresJson.digitalMenu,
  };
}

function toInput(form: PlanFormState): PlanInput {
  return {
    name: form.name.trim(),
    price: Number(form.price),
    billingCycle: form.billingCycle,
    maxThemes: Number(form.maxThemes),
    customDomainAllowed: form.customDomainAllowed,
    featuresJson: {
      analytics: form.analytics,
      // One switch, not two: the plan-level flag and the feature flag used to
      // be separate fields that could disagree.
      customDomain: form.customDomainAllowed,
      whiteLabel: form.whiteLabel,
      digitalMenu: form.digitalMenu,
    },
  };
}

/** The API explains its refusals; say what it said. */
function explain(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function PlanForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: PlanFormState;
  submitLabel: string;
  onSubmit: (form: PlanFormState) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void onSubmit(form).finally(() => {
          setBusy(false);
        });
      }}
      className="flex max-w-md flex-col gap-3"
    >
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded border border-border-color px-3 py-2"
        />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Price (₹) — 0 for a free plan
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="rounded border border-border-color px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Cycle
          <select
            value={form.billingCycle}
            onChange={(e) => setForm({ ...form, billingCycle: e.target.value as 'monthly' | 'yearly' })}
            className="rounded border border-border-color px-3 py-2"
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Max themes
        <input
          required
          type="number"
          min="0"
          value={form.maxThemes}
          onChange={(e) => setForm({ ...form, maxThemes: e.target.value })}
          className="rounded border border-border-color px-3 py-2"
        />
      </label>
      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="mb-1 font-medium">Includes</legend>
        {FEATURES.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2">
            <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="w-fit cursor-pointer rounded-md bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="cursor-pointer rounded-md border border-border-color px-4 py-2">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function PlansContent() {
  const { accessToken } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [formKey, setFormKey] = useState(0);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      setPlans(await listPlans(accessToken));
    } catch (error) {
      setNotice({ tone: 'error', text: explain(error, 'Failed to load plans.') });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleCreate(form: PlanFormState) {
    if (!accessToken) return;
    setNotice(null);
    try {
      await createPlan(accessToken, toInput(form));
      setNotice({ tone: 'ok', text: `Plan “${form.name.trim()}” created. Assign it to clients from Clients.` });
      setFormKey((k) => k + 1); // reset the form
      await refresh();
    } catch (error) {
      setNotice({ tone: 'error', text: explain(error, 'Failed to create plan.') });
    }
  }

  async function handleUpdate(form: PlanFormState) {
    if (!accessToken || !editing) return;
    setNotice(null);
    try {
      await updatePlan(accessToken, editing.id, toInput(form));
      setNotice({ tone: 'ok', text: `Plan “${form.name.trim()}” updated. Clients on it get the change immediately.` });
      setEditing(null);
      await refresh();
    } catch (error) {
      setNotice({ tone: 'error', text: explain(error, 'Failed to update plan.') });
    }
  }

  async function toggleArchived(plan: Plan) {
    if (!accessToken) return;
    setNotice(null);
    try {
      if (plan.isArchived) {
        await updatePlan(accessToken, plan.id, { isArchived: false });
      } else {
        await archivePlan(accessToken, plan.id);
      }
      await refresh();
    } catch (error) {
      setNotice({ tone: 'error', text: explain(error, 'Failed to update plan.') });
    }
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Plans</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Plans are assigned to clients by you, from <a className="underline" href="/super-admin/clients">Clients</a>{' '}
          — clients can’t buy or change a plan themselves. Archiving a plan keeps it for the clients already on it and
          stops it being assigned to anyone new.
        </p>
      </div>

      {notice ? (
        <p className={`text-sm ${notice.tone === 'ok' ? 'text-success' : 'text-danger'}`} role="status">
          {notice.text}
        </p>
      ) : null}

      {isLoading ? (
        <p>Loading…</p>
      ) : plans.length === 0 ? (
        <p className="text-muted">No plans yet — create the first one below.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-color">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-color font-mono text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Themes</th>
                <th className="px-4 py-3">Includes</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-border-color last:border-0">
                  <td className="px-4 py-3 font-medium">{plan.name}</td>
                  <td className="px-4 py-3 font-mono">{formatPrice(plan)}</td>
                  <td className="px-4 py-3">{plan.maxThemes}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {[
                      plan.featuresJson.analytics && 'Analytics',
                      plan.customDomainAllowed && 'Custom domain',
                      plan.featuresJson.whiteLabel && 'White-label',
                      plan.featuresJson.digitalMenu && 'Digital menu',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Basic page only'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={plan.isArchived ? 'neutral' : 'success'}>{plan.isArchived ? 'Archived' : 'Active'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditing(plan);
                        }}
                        className="cursor-pointer rounded border border-border-color px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void toggleArchived(plan)}
                        className="cursor-pointer rounded border border-border-color px-2 py-1"
                      >
                        {plan.isArchived ? 'Unarchive' : 'Archive'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-border-color pt-6">
        {editing ? (
          <>
            <h2 className="mb-3 text-lg font-semibold">Edit “{editing.name}”</h2>
            <PlanForm
              key={editing.id}
              initial={toForm(editing)}
              submitLabel="Save changes"
              onSubmit={handleUpdate}
              onCancel={() => {
                setEditing(null);
              }}
            />
          </>
        ) : (
          <>
            <h2 className="mb-3 text-lg font-semibold">New plan</h2>
            <PlanForm key={formKey} initial={EMPTY_FORM} submitLabel="Create plan" onSubmit={handleCreate} />
          </>
        )}
      </div>
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

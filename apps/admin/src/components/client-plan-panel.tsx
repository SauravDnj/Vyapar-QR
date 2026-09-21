'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  assignClientPlan,
  getClientPlan,
  listPlans,
  setClientPlanActive,
  type ClientPlanState,
  type ClientSubscription,
  type Plan,
} from '../lib/admin-api';
import { ApiError } from '../lib/api-client';

import { Badge, type BadgeTone } from './ui/badge';

const STATUS_TONE: Record<ClientSubscription['status'], BadgeTone> = {
  active: 'success',
  pending: 'warning',
  past_due: 'warning',
  cancelled: 'neutral',
  expired: 'neutral',
};

const FEATURE_LABELS: [keyof Plan['featuresJson'], string][] = [
  ['analytics', 'Analytics'],
  ['customDomain', 'Custom domain'],
  ['whiteLabel', 'White-label'],
  ['digitalMenu', 'Digital menu & ordering'],
];

export function formatPrice(plan: Plan): string {
  const price = Number(plan.price);
  return price === 0 ? 'Free' : `₹${price.toLocaleString('en-IN')}/${plan.billingCycle === 'yearly' ? 'yr' : 'mo'}`;
}

/**
 * The Super Admin's control over one client's plan: give them one, move them
 * to another, switch it off, switch it back on.
 *
 * Switching a plan *off* is kept visibly apart from suspending the client.
 * They sound similar and do different things — a deactivated plan turns the
 * paid features off and leaves the landing page up; a suspended client's page
 * goes offline — so the panel says which one it is doing.
 */
export function ClientPlanPanel({
  accessToken,
  clientId,
  onChanged,
}: {
  accessToken: string;
  clientId: string;
  onChanged: () => Promise<void>;
}) {
  const [state, setState] = useState<ClientPlanState | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const [planState, allPlans] = await Promise.all([getClientPlan(accessToken, clientId), listPlans(accessToken)]);
    setState(planState);
    setPlans(allPlans.filter((plan) => !plan.isArchived));
  }, [accessToken, clientId]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch {
        setNotice({ tone: 'error', text: 'Could not load this client’s plan.' });
      }
    })();
  }, [load]);

  async function act(action: () => Promise<ClientPlanState>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      setState(await action());
      setChosen('');
      setNotice({ tone: 'ok', text: success });
      await onChanged();
    } catch (error) {
      // The API explains every refusal ("already on this plan", "archived");
      // showing it beats a generic failure.
      setNotice({ tone: 'error', text: error instanceof ApiError ? error.message : 'That didn’t work. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return <p className="text-sm text-muted">{notice?.text ?? 'Loading plan…'}</p>;
  }

  const current = state.current;
  const lastPlan = state.history[0] ?? null;
  const chosenPlan = plans.find((plan) => plan.id === chosen) ?? null;
  const choices = plans.filter((plan) => plan.id !== current?.planId);

  return (
    <section className="flex flex-col gap-3 border-t border-border-color pt-4">
      <p className="text-sm font-semibold">Plan</p>

      {current ? (
        <div className="flex flex-col gap-2 rounded-md border border-border-color p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{current.plan.name}</p>
            <Badge tone="success">active</Badge>
          </div>
          <p className="font-mono text-sm text-muted">{formatPrice(current.plan)}</p>
          <ul className="flex flex-wrap gap-1.5 text-xs">
            {FEATURE_LABELS.map(([key, label]) => (
              <li
                key={key}
                className={`rounded px-1.5 py-0.5 ${current.plan.featuresJson[key] ? 'bg-success-bg text-success' : 'text-muted line-through'}`}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border-color p-3 text-sm text-muted">
          No active plan — paid features are off for this client.
          {lastPlan ? ` Last plan: ${lastPlan.plan.name} (${lastPlan.status}).` : ''}
        </p>
      )}

      {notice ? (
        <p className={`text-sm ${notice.tone === 'ok' ? 'text-success' : 'text-danger'}`} role="status">
          {notice.text}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {current ? 'Switch to' : 'Assign a plan'}
          <select
            value={chosen}
            onChange={(event) => {
              setChosen(event.target.value);
            }}
            className="rounded-md border border-border-color px-2 py-2 text-sm"
          >
            <option value="">Choose a plan…</option>
            {choices.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {formatPrice(plan)}
              </option>
            ))}
          </select>
        </label>
        {plans.length === 0 ? (
          <p className="text-xs text-muted">
            No plans yet. Create one under <a className="underline" href="/super-admin/plans">Plans</a>.
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy || !chosenPlan}
          onClick={() => {
            if (!chosenPlan) return;
            void act(
              () => assignClientPlan(accessToken, clientId, chosenPlan.id),
              current ? `Switched to ${chosenPlan.name}.` : `${chosenPlan.name} assigned.`,
            );
          }}
          className="w-fit cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {current ? 'Switch plan' : 'Assign plan'}
        </button>
      </div>

      {current ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void act(() => setClientPlanActive(accessToken, clientId, false), `${current.plan.name} deactivated.`);
            }}
            className="w-fit cursor-pointer rounded-md border border-border-color px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Deactivate plan
          </button>
          <p className="text-xs text-muted">Turns the paid features off. Their page stays online — use Suspend to take it down.</p>
        </div>
      ) : lastPlan && !lastPlan.plan.isArchived ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void act(() => setClientPlanActive(accessToken, clientId, true), `${lastPlan.plan.name} reactivated.`);
          }}
          className="w-fit cursor-pointer rounded-md border border-border-color px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Reactivate {lastPlan.plan.name}
        </button>
      ) : null}

      {state.history.length > 1 ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted">Plan history ({state.history.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {state.history.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between gap-2">
                <span>
                  {sub.plan.name}
                  {sub.gatewaySubscriptionId ? <span className="text-muted"> · Razorpay</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-muted">{new Date(sub.createdAt).toLocaleDateString('en-IN')}</span>
                  <Badge tone={STATUS_TONE[sub.status]}>{sub.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

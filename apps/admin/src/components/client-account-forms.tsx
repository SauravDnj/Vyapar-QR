'use client';

import { useEffect, useState } from 'react';

import { createClientAccount, listPlans, setClientPassword, type Plan } from '../lib/admin-api';
import { ApiError } from '../lib/api-client';

import { formatPrice } from './client-plan-panel';
import { CopyButton, MIN_PASSWORD_LENGTH, PasswordField } from './password-field';

function loginUrl(): string {
  return `${window.location.origin}/login`;
}

/** The details to send the owner, as one block they can paste into WhatsApp. */
function shareText(businessName: string, email: string, password: string): string {
  return `Your ${businessName} account is ready.\nSign in: ${loginUrl()}\nEmail: ${email}\nPassword: ${password}\nPlease change the password after you sign in (Settings → Change password).`;
}

/** The sign-in details, once, with a button to copy them all. */
function Credentials({ businessName, email, password }: { businessName: string; email: string; password: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-success/40 bg-success-bg p-3 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted">Sign in</dt>
        <dd className="break-all font-mono">{loginUrl()}</dd>
        <dt className="text-muted">Email</dt>
        <dd className="break-all font-mono">{email}</dd>
        <dt className="text-muted">Password</dt>
        <dd className="break-all font-mono">{password}</dd>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={shareText(businessName, email, password)} label="Copy details to send" />
        <CopyButton text={password} label="Copy password" />
      </div>
      <p className="text-xs text-muted">
        This is the only time the password is shown — it is stored encrypted, so it can’t be looked up later. If it’s lost, set a new one.
      </p>
    </div>
  );
}

/**
 * Opens a client account: the owner's login and their business, approved
 * from the start. After saving, the sign-in details are shown once to pass on.
 */
export function CreateClientForm({
  accessToken,
  onCreated,
  onClose,
}: {
  accessToken: string;
  onCreated: () => Promise<void>;
  onClose: () => void;
}) {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [planId, setPlanId] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ businessName: string; email: string; password: string; slug: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setPlans((await listPlans(accessToken)).filter((plan) => !plan.isArchived));
      } catch {
        setPlans([]);
      }
    })();
  }, [accessToken]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`The password needs at least ${String(MIN_PASSWORD_LENGTH)} characters.`);
      return;
    }
    setBusy(true);
    try {
      const created = await createClientAccount(accessToken, {
        businessName: businessName.trim(),
        email: email.trim(),
        password,
        planId: planId || undefined,
      });
      setDone({ businessName: created.businessName, email: created.user.email, password, slug: created.slug });
      await onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t create the account. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setBusinessName('');
    setEmail('');
    setPassword('');
    setPlanId('');
    setDone(null);
    setError(null);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-lg font-semibold">Account created</p>
          <p className="text-sm text-muted">
            {done.businessName} is active. Their page address will be <span className="font-mono">/site/{done.slug}</span>. When they sign in they
            carry on with choosing a theme and adding their details.
          </p>
        </div>
        <Credentials businessName={done.businessName} email={done.email} password={done.password} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="min-h-10 cursor-pointer rounded-md border border-border-color px-4 text-sm">
            Create another
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 cursor-pointer rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Create client</p>
          <p className="text-sm text-muted">Opens their login and business together — already approved.</p>
        </div>
        <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close">
          ✕
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Business name
        <input
          value={businessName}
          onChange={(event) => {
            setBusinessName(event.target.value);
          }}
          required
          minLength={2}
          maxLength={120}
          placeholder="e.g. Kalyani Jewellers"
          autoComplete="organization"
          className="rounded-md border border-border-color px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Owner’s email (their login)
        <input
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          required
          placeholder="owner@business.com"
          autoComplete="off"
          spellCheck={false}
          className="rounded-md border border-border-color px-3 py-2"
        />
      </label>

      <PasswordField label="Password" value={password} onChange={setPassword} disabled={busy} />

      <label className="flex flex-col gap-1 text-sm">
        Plan
        <select
          value={planId}
          onChange={(event) => {
            setPlanId(event.target.value);
          }}
          className="rounded-md border border-border-color px-2 py-2"
        >
          <option value="">No plan yet — assign one later</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {formatPrice(plan)}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="min-h-10 w-fit cursor-pointer rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}

/**
 * The client's login in their drawer: who signs in, and a way to give them
 * a new password when they've forgotten theirs or it needs changing.
 */
export function ClientLoginPanel({
  accessToken,
  clientId,
  businessName,
  email,
}: {
  accessToken: string;
  clientId: string;
  businessName: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`The password needs at least ${String(MIN_PASSWORD_LENGTH)} characters.`);
      return;
    }
    setBusy(true);
    try {
      await setClientPassword(accessToken, clientId, password);
      setSaved(password);
      setPassword('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t change the password. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border-color pt-4">
      <p className="text-sm font-semibold">Login &amp; password</p>
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted">Signs in with</p>
        <p className="break-all font-mono">{email}</p>
      </div>

      {saved ? (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm text-success">
            Password changed. They’ve been signed out everywhere and must use the new one.
          </p>
          <Credentials businessName={businessName} email={email} password={saved} />
        </div>
      ) : null}

      {open ? (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 rounded-md border border-border-color p-3">
          <PasswordField label="New password" value={password} onChange={setPassword} disabled={busy} />
          <p className="text-xs text-muted">Their old password stops working and any device they’re signed in on is signed out.</p>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-10 cursor-pointer rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save new password'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setPassword('');
                setError(null);
              }}
              className="min-h-10 cursor-pointer rounded-md border border-border-color px-4 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSaved(null);
          }}
          className="min-h-10 w-fit cursor-pointer rounded-md border border-border-color px-3 text-sm"
        >
          {saved ? 'Set another password' : 'Set new password'}
        </button>
      )}
    </section>
  );
}

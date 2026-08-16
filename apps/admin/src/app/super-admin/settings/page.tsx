'use client';

import { useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { getSettings, updateSettings } from '../../../lib/admin-api';

function SettingsContent() {
  const { accessToken } = useAuth();
  const [supportEmail, setSupportEmail] = useState('');
  const [trialDays, setTrialDays] = useState('7');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    async function load() {
      try {
        const settings = await getSettings(accessToken as string);
        if (cancelled) return;
        setSupportEmail(typeof settings.supportEmail === 'string' ? settings.supportEmail : '');
        setTrialDays(typeof settings.trialDays === 'number' ? String(settings.trialDays) : '7');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setMessage(null);
    try {
      await updateSettings(accessToken, { supportEmail, trialDays: Number(trialDays) });
      setMessage('Saved.');
    } catch {
      setMessage('Failed to save settings.');
    }
  }

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Platform settings</h1>
      <form
        onSubmit={(e) => void handleSave(e)}
        className="flex max-w-md flex-col gap-3 rounded-lg border border-border-color bg-surface p-5"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Support email
          <input
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            className="rounded-md border border-border-color px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Default trial length (days)
          <input
            type="number"
            min="0"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            className="rounded-md border border-border-color px-3 py-2"
          />
        </label>
        {message && <p className="text-sm text-muted">{message}</p>}
        <button type="submit" className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
          Save
        </button>
      </form>
    </>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <SettingsContent />
    </ProtectedRoute>
  );
}

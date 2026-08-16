'use client';

import { useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { ApiError, changePassword } from '../../../lib/account-api';
import { sendTestDigest } from '../../../lib/digest-api';

function SettingsContent() {
  const { user, accessToken } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSendingDigest, setIsSendingDigest] = useState(false);
  const [digestMessage, setDigestMessage] = useState<string | null>(null);

  async function handleSendDigest() {
    if (!accessToken) return;
    setIsSendingDigest(true);
    setDigestMessage(null);
    try {
      await sendTestDigest(accessToken);
      setDigestMessage('Sent — check your inbox.');
    } catch {
      setDigestMessage('Failed to send.');
    } finally {
      setIsSendingDigest(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await changePassword(accessToken, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password updated.');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to update password.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Account settings</h1>

      <section className="flex max-w-md flex-col gap-3 rounded-lg border border-border-color bg-surface p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="font-medium">Account</p>
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-muted">Email</p>
          <p className="font-mono">{user?.email}</p>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-muted">Role</p>
          <p className="font-mono">{user?.role}</p>
        </div>
      </section>

      <section className="flex max-w-md flex-col gap-3 rounded-lg border border-border-color bg-surface p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="font-medium">Weekly digest</p>
        <p className="text-sm text-muted">
          Every Monday you get an emailed summary of page views, QR scans, new leads, and new testimonials.
        </p>
        <button
          disabled={isSendingDigest}
          onClick={() => void handleSendDigest()}
          className="w-fit rounded-md border border-border-color px-4 py-2 text-sm disabled:opacity-50"
        >
          {isSendingDigest ? 'Sending…' : 'Send me a test digest now'}
        </button>
        {digestMessage && <p className="text-sm">{digestMessage}</p>}
      </section>

      <form
        onSubmit={(event) => void handleChangePassword(event)}
        className="flex max-w-md flex-col gap-3 rounded-lg border border-border-color bg-surface p-5"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <p className="font-medium">Change password</p>
        <label className="flex flex-col gap-1 text-sm">
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            className="rounded-md border border-border-color px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            required
            className="rounded-md border border-border-color px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
            className="rounded-md border border-border-color px-3 py-2"
          />
        </label>
        {message && <p className="text-sm">{message}</p>}
        <button
          type="submit"
          disabled={isSaving}
          className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin', 'client_staff']}>
      <SettingsContent />
    </ProtectedRoute>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedRoute } from '../../../components/protected-route';
import { Badge } from '../../../components/ui/badge';
import { useAuth } from '../../../context/auth-context';
import {
  ApiError,
  inviteStaff,
  listStaff,
  removeStaff,
  updateStaffPermissions,
  type StaffMember,
} from '../../../lib/staff-api';

import type { StaffPermissions } from '@qrhub/types';

const PERMISSION_LABELS: { key: keyof StaffPermissions; label: string }[] = [
  { key: 'leads', label: 'Leads / CRM' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'billing', label: 'Billing' },
  { key: 'domains', label: 'Custom domain' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'menu', label: 'Menu' },
  { key: 'orders', label: 'Orders' },
];

const FULL_ACCESS: StaffPermissions = {
  leads: true,
  reviews: true,
  analytics: true,
  billing: true,
  domains: true,
  whatsapp: true,
  menu: true,
  orders: true,
};

function PermissionCheckboxes({
  value,
  onChange,
}: {
  value: StaffPermissions;
  onChange: (next: StaffPermissions) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {PERMISSION_LABELS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function MemberPermissionsRow({
  member,
  accessToken,
  onSaved,
}: {
  member: StaffMember;
  accessToken: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StaffPermissions>(member.permissionsJson ?? FULL_ACCESS);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    try {
      await updateStaffPermissions(accessToken, member.id, draft);
      setEditing(false);
      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  if (!editing) {
    const perms = member.permissionsJson ?? FULL_ACCESS;
    const granted = PERMISSION_LABELS.filter(({ key }) => perms[key]).map(({ label }) => label);
    return (
      <button onClick={() => setEditing(true)} className="text-left text-xs text-muted underline decoration-dotted">
        {granted.length === PERMISSION_LABELS.length ? 'Full access' : granted.join(', ') || 'No access'}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-border-color bg-surface p-3">
      <PermissionCheckboxes value={draft} onChange={setDraft} />
      <div className="flex gap-2">
        <button
          onClick={() => void save()}
          disabled={isSaving}
          className="rounded bg-accent px-3 py-1 text-xs text-accent-foreground disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setEditing(false)} className="rounded border border-border-color px-3 py-1 text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}

function StaffContent() {
  const { accessToken } = useAuth();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState('');
  const [invitePermissions, setInvitePermissions] = useState<StaffPermissions>(FULL_ACCESS);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      setMembers(await listStaff(accessToken));
    } catch {
      setMessage('Failed to load team members.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !email.trim()) return;
    setIsInviting(true);
    setMessage(null);
    setLastInviteUrl(null);
    try {
      const result = await inviteStaff(accessToken, email.trim(), invitePermissions);
      setLastInviteUrl(result.inviteUrl);
      setEmail('');
      setInvitePermissions(FULL_ACCESS);
      await refresh();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to send invite.');
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemove(id: string) {
    if (!accessToken) return;
    try {
      await removeStaff(accessToken, id);
      await refresh();
    } catch {
      setMessage('Failed to remove team member.');
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Team</h1>
      <p className="max-w-lg text-sm text-muted">
        Invite staff to help manage your business page, and choose exactly which areas each person can access.
      </p>
      {message && <p className="text-sm text-danger">{message}</p>}

      <form onSubmit={(e) => void handleInvite(e)} className="flex max-w-md flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded border border-border-color px-3 py-2"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-sm">Access</span>
          <PermissionCheckboxes value={invitePermissions} onChange={setInvitePermissions} />
        </div>
        <button
          type="submit"
          disabled={isInviting}
          className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground disabled:opacity-50"
        >
          {isInviting ? 'Sending…' : 'Invite'}
        </button>
      </form>

      {lastInviteUrl && (
        <div className="max-w-lg rounded border border-success bg-success-bg p-3 text-sm text-success">
          <p>Invite created. If email isn&apos;t set up yet, share this link directly:</p>
          <code className="mt-1 block break-all text-xs">{lastInviteUrl}</code>
        </div>
      )}

      {isLoading ? (
        <p>Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-muted">No team members yet.</p>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-color">
              <th className="py-2">Email</th>
              <th>Status</th>
              <th>Access</th>
              <th>Invited</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-border-color align-top">
                <td className="py-2">{member.invitedEmail}</td>
                <td>
                  <Badge tone={member.status === 'active' ? 'success' : 'warning'}>{member.status}</Badge>
                </td>
                <td className="max-w-xs">
                  {accessToken && (
                    <MemberPermissionsRow member={member} accessToken={accessToken} onSaved={() => void refresh()} />
                  )}
                </td>
                <td className="text-muted">{new Date(member.createdAt).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => void handleRemove(member.id)} className="text-sm text-danger">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

export default function StaffPage() {
  return (
    <ProtectedRoute allowedRoles={['client_admin']}>
      <StaffContent />
    </ProtectedRoute>
  );
}

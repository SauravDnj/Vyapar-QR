import { ApiError, apiFetch } from './api-client';

import type { StaffPermissions } from '@qrhub/types';

export interface StaffMember {
  id: string;
  invitedEmail: string;
  status: 'invited' | 'active';
  createdAt: string;
  permissionsJson: StaffPermissions | null;
}

export function listStaff(accessToken: string) {
  return apiFetch<StaffMember[]>('/staff', { accessToken });
}

export function inviteStaff(accessToken: string, email: string, permissions?: StaffPermissions) {
  return apiFetch<{ member: StaffMember; inviteUrl: string }>('/staff/invite', {
    method: 'POST',
    body: { email, permissions },
    accessToken,
  });
}

export function updateStaffPermissions(accessToken: string, id: string, permissions: StaffPermissions) {
  return apiFetch<StaffMember>(`/staff/${id}/permissions`, { method: 'PATCH', body: permissions, accessToken });
}

export function removeStaff(accessToken: string, id: string) {
  return apiFetch<void>(`/staff/${id}`, { method: 'DELETE', accessToken });
}

export { ApiError };

import { ApiError, apiFetch } from './api-client';

export function changePassword(accessToken: string, currentPassword: string, newPassword: string) {
  return apiFetch<{ success: true }>('/auth/change-password', {
    method: 'PATCH',
    body: { currentPassword, newPassword },
    accessToken,
  });
}

export { ApiError };

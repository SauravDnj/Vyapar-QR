'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, apiFetch } from '../lib/api-client';

import type { UserRole } from '@qrhub/types';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  /** True until the initial silent-refresh attempt on load has resolved. */
  isLoading: boolean;
  /** Set while viewing the app as another user via Super Admin impersonation. */
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<AuthUser>;
  acceptInvite: (token: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Switches the active session to an impersonation access token, keeping
   * the original Super Admin session so it can be restored afterwards. */
  startImpersonation: (accessToken: string) => Promise<AuthUser>;
  /** Restores the Super Admin's own session after impersonating a client. */
  exitImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminSession, setAdminSession] = useState<{ accessToken: string; user: AuthUser } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function silentRefresh() {
      try {
        const { accessToken: token } = await apiFetch<{ accessToken: string }>('/auth/refresh', {
          method: 'POST',
        });
        const me = await apiFetch<AuthUser>('/auth/me', { accessToken: token });
        if (!cancelled) {
          setAccessToken(token);
          setUser(me);
        }
      } catch {
        // No valid session — user stays signed out.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void silentRefresh();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const acceptInvite = useCallback(async (token: string, password: string) => {
    const result = await apiFetch<AuthResponse>('/auth/accept-invite', {
      method: 'POST',
      body: { token, password },
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', accessToken });
    } catch {
      // Best-effort: clear local state regardless of API result.
    }
    setAccessToken(null);
    setUser(null);
    setAdminSession(null);
  }, [accessToken]);

  const startImpersonation = useCallback(
    async (impersonationToken: string) => {
      if (user && accessToken) {
        setAdminSession({ accessToken, user });
      }
      const me = await apiFetch<AuthUser>('/auth/me', { accessToken: impersonationToken });
      setAccessToken(impersonationToken);
      setUser(me);
      return me;
    },
    [user, accessToken],
  );

  const exitImpersonation = useCallback(async () => {
    if (!adminSession) {
      return;
    }
    setAccessToken(adminSession.accessToken);
    setUser(adminSession.user);
    setAdminSession(null);
  }, [adminSession]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isLoading,
      isImpersonating: adminSession !== null,
      login,
      register,
      acceptInvite,
      logout,
      startImpersonation,
      exitImpersonation,
    }),
    [
      user,
      accessToken,
      isLoading,
      adminSession,
      login,
      register,
      acceptInvite,
      logout,
      startImpersonation,
      exitImpersonation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { ApiError };

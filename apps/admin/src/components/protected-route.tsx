'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '../context/auth-context';

import type { UserRole } from '@qrhub/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

/** Client-side route guard. The API lives on a separate origin, so its
 * httpOnly refresh cookie is invisible to Next.js proxy/middleware — auth
 * state can only be known after the browser calls the API directly. */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      router.replace(user.role === 'super_admin' ? '/super-admin' : user.role === 'agency_admin' ? '/agency' : '/dashboard');
    }
  }, [isLoading, user, allowedRoles, router]);

  if (isLoading || !user || !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '../context/auth-context';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!user) {
      router.replace('/login');
    } else {
      router.replace(user.role === 'super_admin' ? '/super-admin' : '/dashboard');
    }
  }, [isLoading, user, router]);

  return null;
}

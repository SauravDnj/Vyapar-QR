'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '../context/auth-context';

export function SuperAdminNav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <nav className="flex items-center justify-between border-b px-8 py-4">
      <div className="flex gap-6">
        <Link href="/super-admin" className="font-semibold">
          QRHub Admin
        </Link>
        <Link href="/super-admin/clients">Clients</Link>
        <Link href="/super-admin/plans">Plans</Link>
        <Link href="/super-admin/analytics">Analytics</Link>
        <Link href="/super-admin/reports">Reports</Link>
        <Link href="/super-admin/settings">Settings</Link>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span>{user?.email}</span>
        <button onClick={() => void handleLogout()} className="rounded border px-3 py-1">
          Sign out
        </button>
      </div>
    </nav>
  );
}

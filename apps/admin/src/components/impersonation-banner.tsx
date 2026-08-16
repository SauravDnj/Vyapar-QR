'use client';

import { useRouter } from 'next/navigation';

import { useAuth } from '../context/auth-context';

export function ImpersonationBanner() {
  const { isImpersonating, user, exitImpersonation } = useAuth();
  const router = useRouter();

  if (!isImpersonating) {
    return null;
  }

  async function handleExit() {
    await exitImpersonation();
    router.push('/super-admin/clients');
  }

  return (
    <div className="flex items-center justify-between bg-yellow-300 px-8 py-2 text-sm text-black">
      <span>Viewing as {user?.email} (impersonation session)</span>
      <button onClick={() => void handleExit()} className="rounded border border-black px-3 py-1">
        Exit impersonation
      </button>
    </div>
  );
}

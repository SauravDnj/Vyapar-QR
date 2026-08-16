'use client';

import { DashboardShell, type NavSection } from '../../components/ui/dashboard-shell';
import { useAuth } from '../../context/auth-context';

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Agency',
    items: [{ label: 'Dashboard', href: '/agency' }],
  },
];

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <DashboardShell brand="QRHub · Agency" navSections={NAV_SECTIONS} user={user} onLogout={logout}>
      {children}
    </DashboardShell>
  );
}

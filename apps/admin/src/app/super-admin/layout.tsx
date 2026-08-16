'use client';

import { DashboardShell, type NavSection } from '../../components/ui/dashboard-shell';
import { useAuth } from '../../context/auth-context';

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Platform',
    items: [
      { label: 'Overview', href: '/super-admin' },
      { label: 'Clients', href: '/super-admin/clients' },
      { label: 'Agencies', href: '/super-admin/agencies' },
      { label: 'Plans & Pricing', href: '/super-admin/plans' },
      { label: 'Theme Catalog', href: '/super-admin/themes' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Billing Reports', href: '/super-admin/reports' },
      { label: 'Platform Analytics', href: '/super-admin/analytics' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Audit Log', href: '/super-admin/audit-log' },
      { label: 'Settings', href: '/super-admin/settings' },
    ],
  },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <DashboardShell
      brand="QRHub · Super Admin"
      navSections={NAV_SECTIONS}
      user={user}
      onLogout={logout}
    >
      {children}
    </DashboardShell>
  );
}

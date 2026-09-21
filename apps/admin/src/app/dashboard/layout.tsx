'use client';

import { NotificationBell } from '../../components/notification-bell';
import { DashboardShell, type NavSection } from '../../components/ui/dashboard-shell';
import { useAuth } from '../../context/auth-context';

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Your page',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'My Landing Page', href: '/dashboard/theme' },
      { label: 'Locations', href: '/dashboard/locations' },
      { label: 'Promo QR Codes', href: '/dashboard/qr-codes' },
      { label: 'Payment Methods', href: '/dashboard/payment-methods' },
      { label: 'Google Reviews', href: '/dashboard/reviews' },
      { label: 'Testimonials', href: '/dashboard/testimonials' },
      { label: 'Loyalty Program', href: '/dashboard/loyalty' },
      { label: 'Coupons', href: '/dashboard/coupons' },
      { label: 'Appointment Booking', href: '/dashboard/bookings' },
      { label: 'Menu', href: '/dashboard/menu' },
    ],
  },
  {
    title: 'Grow',
    items: [
      { label: 'Leads (CRM)', href: '/dashboard/leads' },
      { label: 'Payments', href: '/dashboard/payments' },
      // Beside the data it exports. It used to be reachable only from a
      // "Webhooks" button on the dashboard home, which is not where anyone
      // looking for Google Sheets would look.
      { label: 'Google Sheets', href: '/dashboard/webhooks' },
      { label: 'Scan Activity', href: '/dashboard/visitors' },
      { label: 'Orders', href: '/dashboard/orders' },
      { label: 'WhatsApp', href: '/dashboard/whatsapp' },
      { label: 'Analytics', href: '/dashboard/analytics' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Billing', href: '/dashboard/billing' },
      { label: 'Custom Domain', href: '/dashboard/domain' },
      { label: 'Settings', href: '/dashboard/settings' },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <DashboardShell navSections={NAV_SECTIONS} headerExtra={<NotificationBell />} user={user} onLogout={logout}>
      {children}
    </DashboardShell>
  );
}

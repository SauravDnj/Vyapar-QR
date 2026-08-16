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
    <DashboardShell brand="QRHub" navSections={NAV_SECTIONS} headerExtra={<NotificationBell />} user={user} onLogout={logout}>
      {children}
    </DashboardShell>
  );
}

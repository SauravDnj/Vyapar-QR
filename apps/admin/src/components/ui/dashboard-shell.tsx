'use client';

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ImpersonationBanner } from '../impersonation-banner';

import { ThemeToggle } from './theme-toggle';

import type { AuthUser } from '../../context/auth-context';

export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export function DashboardShell({
  brand,
  navSections,
  footer,
  headerExtra,
  user,
  onLogout,
  children,
}: {
  brand: string;
  navSections: NavSection[];
  /** Rendered above [Log out] in the sidebar footer, e.g. a plan badge. */
  footer?: React.ReactNode;
  /** Rendered in the header, before the user email/theme toggle — e.g. a
   * notification bell. Only the client dashboard passes one today; agency
   * and super-admin layouts are unaffected when omitted. */
  headerExtra?: React.ReactNode;
  user: AuthUser | null;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const activeItem = navSections
    .flatMap((section) => section.items)
    .find((item) => item.href === pathname);

  async function handleLogout() {
    await onLogout();
    router.push('/login');
  }

  function renderNavContent(layoutGroupId: string) {
    return (
      <>
        <p className="font-mono text-sm font-semibold tracking-tight">{brand}</p>
        <LayoutGroup id={layoutGroupId}>
          <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
            {navSections.map((section) => (
              <div key={section.title} className="flex flex-col gap-1">
                <p className="px-2 font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                  {section.title}
                </p>
                {section.items.map((item) => {
                  const isActive = item.href === pathname;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsDrawerOpen(false)}
                      className={`relative rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                        isActive ? 'text-accent' : 'text-foreground hover:bg-border-color/40'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="nav-active-pill"
                          className="absolute inset-0 rounded-md bg-accent/10"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                      <span className="relative">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </LayoutGroup>
        <div className="flex flex-col gap-3 border-t border-border-color pt-3">
          {footer}
          <button
            onClick={() => void handleLogout()}
            className="w-fit rounded-md border border-border-color px-3 py-1.5 text-sm"
          >
            Log out
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-1">
      {/* Desktop sidebar */}
      <aside className="hidden w-58 shrink-0 flex-col gap-5 border-r border-border-color bg-surface p-4 md:flex">
        {renderNavContent('desktop-nav')}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isDrawerOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.button
              aria-label="Close menu"
              className="absolute inset-0 bg-black/40"
              onClick={() => setIsDrawerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="relative flex h-full w-64 flex-col gap-5 bg-surface p-4 shadow-card"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              {renderNavContent('mobile-nav')}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <ImpersonationBanner />
        <header className="flex items-center justify-between border-b border-border-color px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              onClick={() => setIsDrawerOpen(true)}
              className="rounded-md border border-border-color px-2 py-1 text-sm md:hidden"
            >
              ☰
            </button>
            <p className="text-lg font-semibold">{activeItem?.label ?? brand}</p>
          </div>
          <div className="flex items-center gap-3">
            {headerExtra}
            <p className="hidden text-sm text-muted sm:block">{user?.email}</p>
            <ThemeToggle />
          </div>
        </header>
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="flex flex-1 flex-col gap-6 p-4 md:p-8"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}

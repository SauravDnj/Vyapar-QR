import { AuthProvider } from '../context/auth-context';

import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'QRHub Admin',
  description: 'QRHub Super Admin & Client Admin dashboard',
};

/** Runs before paint so a stored/system dark preference doesn't flash the
 * light theme first. Kept inline (not a module) since it must execute
 * synchronously during hydration, before React or any stylesheet-driven
 * media query has a chance to render. */
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem('qrhub-theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The theme-init script below sets `data-theme` on this element before
    // React hydrates, so the server-rendered markup and the live DOM
    // legitimately differ on that one attribute — suppressHydrationWarning
    // scopes the (expected, harmless) mismatch to just this element instead
    // of Next.js treating it as a real bug.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

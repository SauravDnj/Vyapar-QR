import { BRAND_NAME, BRAND_TAGLINE } from '@vyaparqr/ui';

import type { Metadata } from 'next';
import './globals.css';

/** Client pages under /site/[slug] set their own title and description; this
 * is only what the platform's own pages show. */
export const metadata: Metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description:
    'Vyapar QR gives your business one QR code that opens a page with UPI payments, Google reviews, WhatsApp chat and your contact details.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

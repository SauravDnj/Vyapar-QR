'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

/** Uses the native share sheet where available (mobile browsers — this is
 * a QR-scanned page, so almost everyone viewing it is on mobile); falls
 * back to copying the link for desktop browsers without Web Share. */
export function ShareButton({ businessName }: { businessName: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: businessName, url });
      } catch {
        // User cancelled the share sheet — not an error worth surfacing.
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <motion.button
      type="button"
      onClick={() => void handleShare()}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="text-sm font-medium underline"
    >
      {copied ? 'Link copied!' : 'Share this page'}
    </motion.button>
  );
}

'use client';

import { motion } from 'framer-motion';

import { isPdfUrl } from './theme-content';

/** Renders a client-uploaded menu/brochure file — as an inline, tap-to-enlarge
 * image, or as a "View" card for a PDF (embedding PDFs inline is unreliable
 * on mobile browsers, so this opens it in a new tab instead). */
export function DocumentViewer({ url, label }: { url: string; label: string }) {
  if (isPdfUrl(url)) {
    return (
      <motion.a
        href={url}
        target="_blank"
        rel="noreferrer"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3 rounded-lg border px-5 py-4 text-sm font-medium"
        style={{ borderColor: 'var(--theme-accent,#0e7c66)', color: 'var(--theme-accent,#0e7c66)' }}
      >
        <span aria-hidden className="text-xl">
          📄
        </span>
        <span>View {label} (PDF)</span>
      </motion.a>
    );
  }

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noreferrer"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="block overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--theme-accent,#0e7c66)' }}
    >
      <img src={url} alt={label} className="w-full object-contain" />
    </motion.a>
  );
}

'use client';

import { motion } from 'framer-motion';

/** Fades/slides a theme section in as it scrolls into view. `viewport.once`
 * so re-scrolling past a section doesn't re-trigger it, and a small
 * `amount` so short sections on tall phone screens still animate instead
 * of already being "in view" at 0 scroll. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

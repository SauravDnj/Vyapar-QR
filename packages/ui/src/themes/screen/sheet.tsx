'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';

import { Icon } from '../../icon';

/**
 * The bottom sheet every single-screen theme opens its sections in.
 *
 * It is positioned inside the theme's own root rather than portalled to
 * `<body>`, so in the admin's phone-frame preview it stays inside the phone
 * instead of covering the dashboard. On a real phone the root *is* the
 * viewport, so the two are the same thing.
 *
 * Dismiss by the close button, the backdrop, Escape, or dragging it down.
 * The page never scrolls; only the sheet body does, and only when its
 * content is taller than the sheet.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="qs-sheet-layer absolute inset-0 z-50 flex flex-col justify-end">
          <motion.button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="qs-backdrop absolute inset-0 cursor-default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="qs-sheet relative flex max-h-[88%] flex-col outline-none"
            initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag={reduceMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="flex shrink-0 cursor-grab flex-col items-center pt-2.5 active:cursor-grabbing">
              <span className="qs-sheet-handle h-1.5 w-10 rounded-full" aria-hidden="true" />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-2 pb-3">
              <h2 className="qs-sheet-title truncate text-lg font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="qs-sheet-close flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-90"
              >
                <Icon name="close" className="size-5" />
              </button>
            </div>
            {/* Dragging starts only from the handle area above; the body has to
                stay scrollable, so it cancels the drag gesture. */}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),20px)]"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

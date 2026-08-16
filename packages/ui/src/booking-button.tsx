'use client';

import { motion } from 'framer-motion';

import type { CSSProperties } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

function trackClick(slug: string | undefined) {
  if (!slug) return;
  void fetch(`${API_URL}/public/landing/${slug}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'button_click', meta: { label: 'booking' } }),
    keepalive: true,
  });
}

export function BookingButton({ url, slug, accentStyle }: { url: string; slug?: string; accentStyle?: CSSProperties }) {
  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={() => {
        trackClick(slug);
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="flex items-center justify-center rounded-lg px-6 py-3 text-center font-medium text-white"
      style={accentStyle ?? { backgroundColor: '#0e7c66' }}
    >
      Book an appointment
    </motion.a>
  );
}

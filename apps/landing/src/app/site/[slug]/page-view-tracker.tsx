'use client';

import { useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

/** Fires a page_view analytics beacon once per mount. */
export function PageViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    void fetch(`${API_URL}/public/landing/${slug}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'page_view' }),
    });
  }, [slug]);

  return null;
}

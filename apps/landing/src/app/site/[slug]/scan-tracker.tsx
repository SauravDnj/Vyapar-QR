'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

/** Fires the scan-tracking beacon client-side so `?src=qr` doesn't force the
 * page itself out of ISR caching — reading searchParams server-side would. */
export function ScanTracker({ slug }: { slug: string }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('src') !== 'qr') {
      return;
    }
    const qrId = searchParams.get('qr');
    const query = qrId ? `?qr=${encodeURIComponent(qrId)}` : '';
    void fetch(`${API_URL}/public/landing/${slug}/scan${query}`, { method: 'POST' });
  }, [searchParams, slug]);

  return null;
}

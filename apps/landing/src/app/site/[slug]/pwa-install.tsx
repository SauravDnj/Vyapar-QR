'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'qrhub-pwa-install-dismissed';

/** Registers the service worker (required for Chrome/Android install
 * eligibility) and shows a custom "Add to Home Screen" prompt. Android/Chrome
 * fires `beforeinstallprompt`, which we capture and replay on tap; iOS Safari
 * never fires that event, so it gets static instructions instead. */
export function PwaInstall({ businessName }: { businessName: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failing (e.g. unsupported browser) just means no
        // install prompt — not worth surfacing to the user.
      });
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;

    // Deliberately set post-mount, not via a lazy useState initializer: these
    // values depend on `window`/`navigator`, which don't exist during SSR —
    // computing them eagerly would make the server-rendered and first
    // client-rendered output diverge (a real hydration mismatch), whereas
    // setting them here only runs client-side, after the SSR-safe defaults
    // (`isIos: false`, `isDismissed: true`) have already hydrated cleanly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIos(ios);
    setIsDismissed(isStandalone || dismissed);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setIsDismissed(true);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (isDismissed || (!deferredPrompt && !isIos)) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-lg">
      {isIos ? (
        <p className="flex-1 text-gray-700">
          Add {businessName} to your Home Screen: tap <span className="font-medium">Share</span> then{' '}
          <span className="font-medium">Add to Home Screen</span>.
        </p>
      ) : (
        <p className="flex-1 text-gray-700">Add {businessName} to your Home Screen for quick access.</p>
      )}
      <div className="flex shrink-0 flex-col gap-1">
        {!isIos ? (
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            Add
          </button>
        ) : null}
        <button type="button" onClick={dismiss} className="text-xs text-gray-400 underline">
          Dismiss
        </button>
      </div>
    </div>
  );
}

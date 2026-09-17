import type { CSSProperties } from 'react';

/**
 * A phone-sized preview of a customer page.
 *
 * Themes are exactly one screen tall and never scroll, so the frame has a
 * fixed phone height rather than a scrolling box, and hands that height to
 * the theme through `--qr-screen-h`. The theme's sheets open inside it.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[36px] border-[6px] border-[#18181b] bg-[#18181b]"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div
        className="relative h-[720px] max-h-[calc(100dvh-8rem)] min-h-[560px] overflow-hidden rounded-[30px] bg-white"
        style={{ '--qr-screen-h': '100%' } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

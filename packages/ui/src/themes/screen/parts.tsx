import { preconnect } from 'react-dom';

import type { PaymentMethodType, PublicPaymentMethod } from '@vyaparqr/types';

/**
 * Styles shared by every single-screen theme.
 *
 * Shipped as a hoisted `<style>` rather than in each app's globals.css so a
 * theme is self-contained: the landing app and the admin preview render the
 * identical page without either having to remember to copy CSS across.
 *
 * `--t-*` are the same custom properties `PaymentButtons` already reads, so
 * the payment flow picks up each theme's colours with no extra wiring.
 */
const BASE_CSS = `
.qs-root{position:relative;isolation:isolate;overflow:hidden;width:100%;height:var(--qr-screen-h,100dvh);container:qs/size;color:var(--t-text);background:var(--t-bg);font-family:var(--qs-body);-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-font-smoothing:antialiased;--qs-ink:color-mix(in srgb,var(--t-accent) 70%,#1c1917)}
.qs-frame{position:relative;z-index:1;display:flex;flex-direction:column;height:100%;padding:max(env(safe-area-inset-top),14px) 18px max(env(safe-area-inset-bottom),10px);--qs-logo:104px}
.qs-root :focus-visible{outline:2px solid var(--qs-focus,var(--t-accent));outline-offset:3px}
.qs-root a,.qs-root button{cursor:pointer;-webkit-user-select:none;user-select:none}
.qs-display{font-family:var(--qs-display)}
.qs-clamp-1,.qs-clamp-2{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.qs-clamp-1{-webkit-line-clamp:1}.qs-clamp-2{-webkit-line-clamp:2}
.qs-press{transition:transform .16s ease,background-color .2s ease,opacity .2s ease}
.qs-press:active{transform:scale(.96)}
.qs-rise{animation:qs-rise .75s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i,0) * 75ms + 60ms)}
.qs-pop{animation:qs-pop .6s cubic-bezier(.34,1.56,.64,1) both;animation-delay:calc(var(--i,0) * 60ms + 260ms)}
@keyframes qs-rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@keyframes qs-pop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}
@keyframes qs-spin{to{transform:rotate(1turn)}}
@keyframes qs-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes qs-sheen{0%,62%{transform:translateX(-160%) skewX(-22deg)}100%{transform:translateX(260%) skewX(-22deg)}}
@keyframes qs-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--qs-pulse,#fff) 45%,transparent)}100%{box-shadow:0 0 0 14px transparent}}
.qs-sheen{position:relative;overflow:hidden}
.qs-sheen::after{content:"";position:absolute;inset:0 auto 0 0;width:45%;background:linear-gradient(90deg,transparent,rgb(255 255 255/.55),transparent);animation:qs-sheen 4.2s ease-in-out 1.4s infinite;pointer-events:none}
.qs-backdrop{background:rgb(10 8 6/.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.qs-sheet{--t-text:var(--qs-sheet-text);--t-surface:var(--qs-sheet-bg);--t-muted:var(--qs-sheet-muted);--t-border:var(--qs-sheet-border);--t-radius:14px;background:var(--qs-sheet-bg);color:var(--qs-sheet-text);font-family:var(--qs-body);border-radius:28px 28px 0 0;box-shadow:0 -24px 60px -24px rgb(0 0 0/.5)}
.qs-sheet-title{font-family:var(--qs-display)}
.qs-sheet .qs-muted{color:var(--qs-sheet-muted)}
.qs-sheet-handle{background:var(--qs-sheet-border)}
.qs-sheet-close{background:color-mix(in srgb,var(--qs-sheet-text) 7%,transparent)}
.qs-detail-icon{background:color-mix(in srgb,var(--t-accent) 14%,transparent);color:var(--qs-ink)}
.qs-more-tile{background:color-mix(in srgb,var(--qs-sheet-text) 5%,transparent)}
.qs-more-tile svg{color:var(--qs-ink)!important}
.qs-sheet input:not([type=checkbox]):not([type=radio]),.qs-sheet textarea,.qs-sheet select{background:#fff;color:#1c1917;border:1px solid var(--qs-sheet-border);border-radius:12px;min-height:46px;font-size:16px}
.qs-sheet button.bg-black{background:var(--t-accent);color:var(--t-accent-text);border-radius:12px;min-height:46px}
.qs-sheet .border,.qs-sheet .rounded.border{border-color:var(--qs-sheet-border)}
@container qs (max-height:720px){.qs-frame{--qs-logo:84px}.qs-tagline{-webkit-line-clamp:1}}
@container qs (max-height:640px){.qs-frame{--qs-logo:64px}.qs-hide-short{display:none!important}}
@container qs (max-height:560px){.qs-hide-tiny{display:none!important}}
@media (prefers-reduced-motion:reduce){.qs-root *,.qs-root *::before,.qs-root *::after{animation:none!important;transition-duration:.01ms!important}}
`;

/** Hoists the shared styles, the theme's own styles and its web fonts. */
export function ThemeAssets({ id, css, fontsHref }: { id: string; css: string; fontsHref: string }) {
  preconnect('https://fonts.googleapis.com');
  preconnect('https://fonts.gstatic.com', { crossOrigin: 'anonymous' });

  return (
    <>
      <link rel="stylesheet" href={fontsHref} precedence="default" />
      <style href="qs-base" precedence="default">
        {BASE_CSS}
      </style>
      <style href={`qs-theme-${id}`} precedence="default">
        {css}
      </style>
    </>
  );
}

/** Uploaded logo, or the business's initials when there isn't one. */
export function Logo({ url, initials, className }: { url: string; initials: string; className?: string }) {
  if (url) {
    return <img src={url} alt="" className={`h-full w-full object-cover ${className ?? ''}`} decoding="async" />;
  }
  return (
    <span aria-hidden="true" className={`flex h-full w-full items-center justify-center ${className ?? ''}`}>
      {initials}
    </span>
  );
}

/** Five stars filled to the nearest half, with the number beside them. */
export function Stars({ rating, className, size = 14 }: { rating: number; className?: string; size?: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((value) => {
          const fill = rounded >= value ? 1 : rounded >= value - 0.5 ? 0.5 : 0;
          return (
            <svg key={value} width={size} height={size} viewBox="0 0 24 24">
              <defs>
                <linearGradient id={`qs-star-${String(value)}-${String(fill)}`}>
                  <stop offset={fill} stopColor="currentColor" />
                  <stop offset={fill} stopColor="currentColor" stopOpacity="0.28" />
                </linearGradient>
              </defs>
              <path
                d="M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.08 6.33L12 17.31 6.32 20.3l1.08-6.33-4.6-4.49 6.36-.92L12 2.8z"
                fill={`url(#qs-star-${String(value)}-${String(fill)})`}
              />
            </svg>
          );
        })}
      </span>
      <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>
      <span className="sr-only">out of 5 on Google</span>
    </span>
  );
}

const APP_SHORT: Record<PaymentMethodType, string> = {
  gpay: 'GPay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  other: 'UPI',
};

/** "GPay · PhonePe · Paytm" — which apps the pay button leads to. */
export function paymentAppsLine(methods: PublicPaymentMethod[]): string {
  const names = [...methods]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((method) => APP_SHORT[method.type]);
  return [...new Set(names)].join(' · ') || 'UPI';
}

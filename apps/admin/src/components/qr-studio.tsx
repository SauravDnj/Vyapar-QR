'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { fileSlug, loadBrandBadges, loadDesignFonts, loadImage, saveBlob, type LoadedImage } from '../lib/qr-print/assets';
import { canvasToBlob, pdfFromCanvas, pdfFromQrArt } from '../lib/qr-print/pdf';
import { DESIGNS, drawDesign, sheetHeight, type BrandBadge, type DesignKind, type DesignSpec } from '../lib/qr-print/posters';
import { buildQrArt, contrast, mix, qrArtToSvg } from '../lib/qr-print/qr-art';

import type { OnboardingStatus } from '../lib/onboarding-api';
import type { BrandName } from '@vyaparqr/ui';

/** The theme's own default accent (Noor's gold), for a page that never set one. */
const DEFAULT_ACCENT = '#a16207';

export interface StudioBrand {
  businessName: string;
  tagline: string;
  logoUrl: string | null;
  accent: string;
  /** The page address without the protocol, printed as the fallback. */
  address: string;
  verbs: string[];
  brands: BrandName[];
}

/** What the designs print, read from the same data the landing page uses. */
export function studioBrandFrom(status: OnboardingStatus, landingAppUrl: string): StudioBrand {
  const hero = status.landingPage?.contentJson.hero ?? {};
  const pays = status.paymentMethods;
  const hasReview = Boolean(status.googleReviewConfig?.reviewLink);
  const social = new Set(status.socialLinks.map((link) => link.platform));

  const verbs = [pays.length > 0 ? 'Pay' : null, hasReview ? 'Review' : null, social.has('whatsapp') ? 'Chat' : null].filter(
    (verb): verb is string => verb !== null,
  );

  const brands: BrandName[] = [];
  if (pays.length > 0) brands.push('upi');
  for (const type of ['gpay', 'phonepe', 'paytm'] as const) {
    if (pays.some((method) => method.type === type)) brands.push(type);
  }
  if (hasReview) brands.push('google');
  if (social.has('whatsapp')) brands.push('whatsapp');
  if (social.has('instagram')) brands.push('instagram');

  const slug = status.client?.slug ?? '';
  return {
    businessName: status.client?.businessName ?? hero.headline ?? 'Our business',
    tagline: hero.tagline ?? '',
    logoUrl: hero.logoUrl || null,
    accent: status.landingPage?.accentColor ?? DEFAULT_ACCENT,
    address: `${landingAppUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/site/${slug}`,
    verbs: verbs.length > 0 ? verbs : ['Connect'],
    brands: brands.slice(0, 6),
  };
}

type Format = 'png' | 'jpg' | 'pdf' | 'svg';

const FORMAT_LABEL: Record<Format, string> = { png: 'PNG', jpg: 'JPG', pdf: 'PDF', svg: 'SVG' };

/** How wide each design is drawn in the preview, in CSS pixels. */
const PREVIEW_WIDTH: Record<DesignKind, number> = { standee: 300, poster: 320, sticker: 330, qr: 280 };

/**
 * The QR code downloads: three printable designs made from the business's
 * own page, and the bare code, each in the formats a printer asks for.
 *
 * Everything is drawn here in the browser — the preview and the download are
 * the same drawing at two scales, so what is shown is what gets printed, and
 * no download depends on the server building a file.
 */
export function QrStudio({
  targetUrl,
  foreground,
  withLogo,
  brand,
  label = null,
  fileBase,
}: {
  /** What the code encodes — the saved QR's own URL, so scans still count. */
  targetUrl: string;
  foreground: string | null;
  /** Put the logo in the middle of the code. */
  withLogo: boolean;
  brand: StudioBrand;
  /** A promo code's label, e.g. "Table 5". */
  label?: string | null;
  fileBase: string;
}) {
  const [kind, setKind] = useState<DesignKind>('standee');
  const [logo, setLogo] = useState<LoadedImage | null>(null);
  const [badges, setBadges] = useState<BrandBadge[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);

  const brandKey = brand.brands.join(',');
  // The preview waits only for the fonts and brand marks, which are local and
  // quick; the logo is drawn in when it arrives (a monogram stands in till then).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [, loadedBadges] = await Promise.all([
        loadDesignFonts(),
        loadBrandBadges(brandKey ? (brandKey.split(',') as BrandName[]) : []),
      ]);
      if (cancelled) return;
      setBadges(loadedBadges);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [brandKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loadedLogo = brand.logoUrl ? await loadImage(brand.logoUrl) : null;
      if (!cancelled) setLogo(loadedLogo);
    })();
    return () => {
      cancelled = true;
    };
  }, [brand.logoUrl]);

  const spec = DESIGNS.find((design) => design.kind === kind) ?? DESIGNS[0]!;
  const qrLogo = withLogo && logo ? logo.image : null;
  const ink = foreground ?? '#1c1917';

  // Two versions of the same code: the bare one keeps the standard four-module
  // margin; on a poster the white card around it supplies most of that margin.
  const arts = useMemo(() => {
    const accentInk = contrast(brand.accent, '#ffffff') >= 3.2 ? brand.accent : mix(brand.accent, '#1c1208', 0.45);
    return {
      bare: buildQrArt(targetUrl, { foreground: ink, background: '#ffffff', withLogo: Boolean(qrLogo) }),
      card: buildQrArt(targetUrl, { foreground: ink, background: '#ffffff', eye: accentInk, withLogo: Boolean(qrLogo), quiet: 2 }),
    };
  }, [targetUrl, ink, brand.accent, qrLogo]);

  const content = useMemo(
    () => ({
      businessName: brand.businessName,
      tagline: brand.tagline,
      logo: logo?.image ?? null,
      accent: brand.accent,
      address: brand.address,
      label,
      verbs: brand.verbs,
      brands: badges,
    }),
    [brand, logo, badges, label],
  );

  function render(target: HTMLCanvasElement, design: DesignSpec, pixelWidth: number) {
    const ctx = target.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    target.width = Math.round(pixelWidth);
    target.height = Math.round((pixelWidth * sheetHeight(design)) / 1000);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);
    return drawDesign(ctx, design, pixelWidth, design.kind === 'qr' ? arts.bare : arts.card, qrLogo, content);
  }

  // The preview: drawn at the screen's density, with the scan line laid over
  // exactly where the code landed.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const cssWidth = PREVIEW_WIDTH[spec.kind];
    const placement = render(canvas, spec, cssWidth * Math.max(2, window.devicePixelRatio || 1));
    // Height follows the canvas's own aspect ratio, so on a narrow phone the
    // sheet shrinks to fit instead of overflowing.
    canvas.style.width = `${String(cssWidth)}px`;
    const scan = scanRef.current;
    if (scan) {
      scan.style.left = `${String(placement.x * 100)}%`;
      scan.style.top = `${String(placement.y * 100)}%`;
      scan.style.width = `${String(placement.size * 100)}%`;
      scan.style.height = `${String(((placement.size * 1000) / sheetHeight(spec)) * 100)}%`;
    }
    // `render` reads only what is listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, spec, arts, content, qrLogo]);

  const formats: Format[] = kind === 'qr' ? ['png', 'jpg', 'svg', 'pdf'] : ['png', 'jpg', 'pdf'];

  async function download(format: Format) {
    setBusy(format);
    setNotice(null);
    try {
      const name = `${fileSlug(fileBase)}-${kind === 'qr' ? 'qr-code' : kind}`;
      let blob: Blob;
      if (format === 'svg') {
        blob = new Blob([qrArtToSvg(arts.bare, qrLogo && logo ? logo.dataUrl : null)], { type: 'image/svg+xml' });
      } else if (format === 'pdf' && kind === 'qr') {
        blob = await pdfFromQrArt(arts.bare, spec.widthMm, qrLogo);
      } else {
        const canvas = document.createElement('canvas');
        render(canvas, spec, spec.widthPx);
        blob =
          format === 'pdf'
            ? await pdfFromCanvas(canvas, spec.widthMm, spec.heightMm)
            : await canvasToBlob(canvas, format === 'png' ? 'image/png' : 'image/jpeg', 0.94);
      }
      saveBlob(blob, `${name}.${format}`);
      setNotice({ tone: 'ok', text: `${spec.name} saved as ${FORMAT_LABEL[format]}.` });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? `Couldn’t make that file: ${error.message}` : 'Couldn’t make that file. Try again.',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <style>{STUDIO_CSS}</style>

      <div className="qs-stage flex min-h-[360px] items-center justify-center rounded-xl border border-border-color px-4 py-8 lg:w-[400px] lg:shrink-0">
        {ready ? (
          <div className="qs-sheet relative max-w-full">
            <canvas ref={canvasRef} className="block h-auto max-w-full rounded-[6px]" aria-label={`${spec.name} preview`} role="img" />
            <div ref={scanRef} className="qs-scan pointer-events-none absolute" aria-hidden="true">
              <span />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Preparing your designs…</p>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Design</p>
          <div role="radiogroup" aria-label="Design" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DESIGNS.map((design) => (
              <button
                key={design.kind}
                type="button"
                role="radio"
                aria-checked={kind === design.kind}
                onClick={() => {
                  setKind(design.kind);
                  setNotice(null);
                }}
                className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  kind === design.kind ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-border-color hover:border-accent/50'
                }`}
              >
                <DesignGlyph kind={design.kind} accent={brand.accent} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{design.name}</span>
                  <span className="text-xs text-muted">{design.use}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Download</p>
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <button
                key={format}
                type="button"
                disabled={!ready || busy !== null}
                onClick={() => void download(format)}
                className={`min-h-10 min-w-[4.5rem] cursor-pointer rounded-md px-4 text-sm font-medium disabled:cursor-default disabled:opacity-50 ${
                  format === formats[0] ? 'bg-accent text-accent-foreground' : 'border border-border-color'
                }`}
              >
                {busy === format ? 'Making…' : FORMAT_LABEL[format]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {kind === 'qr'
              ? 'PNG and JPG at 2048 × 2048 px. SVG and PDF are vector — sharp at any size.'
              : `${String(spec.widthPx)} × ${String(spec.heightPx)} px — print-ready at 300 dpi. PDF is sized to the page, so print it at 100%.`}
          </p>
          {notice ? (
            <p role="status" className={`text-sm ${notice.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
              {notice.text}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A small outline of each design's shape, so the choice reads at a glance. */
function DesignGlyph({ kind, accent }: { kind: DesignKind; accent: string }) {
  const frame = { standee: [22, 32], poster: [24, 34], sticker: [30, 30], qr: [28, 28] }[kind];
  const [w, h] = frame as [number, number];
  const x = (36 - w) / 2;
  const y = (36 - h) / 2;
  const q = Math.min(w, h) * 0.52;
  const qy = kind === 'sticker' ? y + (h - q) / 2 + 1 : kind === 'qr' ? y + (h - q) / 2 : y + h * 0.42;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" className="shrink-0">
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={kind === 'qr' ? 3 : 3.5}
        fill={kind === 'sticker' ? accent : '#fff'}
        stroke={kind === 'sticker' ? accent : '#d6d3d1'}
      />
      {kind === 'standee' ? <path d={`M${String(x)} ${String(y + 9)} Q18 ${String(y + 14)} ${String(x + w)} ${String(y + 9)} V${String(y + 3.5)} a3.5 3.5 0 0 0-3.5-3.5 H${String(x + 3.5)} a3.5 3.5 0 0 0-3.5 3.5Z`} fill={accent} /> : null}
      <rect x={18 - q / 2} y={qy} width={q} height={q} rx={1.5} fill="#fff" stroke="#1c1917" strokeWidth={1.2} />
      <rect x={18 - q / 2 + 2} y={qy + 2} width={q * 0.3} height={q * 0.3} fill="#1c1917" />
      <rect x={18 + q / 2 - 2 - q * 0.3} y={qy + 2} width={q * 0.3} height={q * 0.3} fill="#1c1917" />
      <rect x={18 - q / 2 + 2} y={qy + q - 2 - q * 0.3} width={q * 0.3} height={q * 0.3} fill="#1c1917" />
    </svg>
  );
}

/* The preview sheet floats a little and a scan line sweeps the code, so it
   reads as "scan this" before a word of it is read. Both stop for anyone who
   has asked for reduced motion. */
const STUDIO_CSS = `
.qs-stage{background:radial-gradient(120% 90% at 50% 0%,color-mix(in srgb,var(--accent) 7%,transparent),transparent 70%),repeating-linear-gradient(45deg,color-mix(in srgb,var(--foreground) 3%,transparent) 0 1px,transparent 1px 12px)}
.qs-sheet{animation:qs-float 6s ease-in-out infinite;will-change:transform}
.qs-sheet canvas{box-shadow:0 22px 40px -12px rgb(20 16 8/.35),0 3px 8px rgb(20 16 8/.14)}
.qs-scan{overflow:hidden;border-radius:4%}
.qs-scan span{position:absolute;left:4%;right:4%;height:18%;top:-18%;background:linear-gradient(180deg,transparent,rgb(34 197 94/.0) 20%,rgb(34 197 94/.28) 82%,rgb(34 197 94/.9) 97%,transparent);animation:qs-sweep 2.8s cubic-bezier(.45,.05,.55,.95) infinite}
@keyframes qs-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes qs-sweep{0%{top:-18%;opacity:0}12%{opacity:1}88%{opacity:1}100%{top:100%;opacity:0}}
@media (prefers-reduced-motion:reduce){.qs-sheet,.qs-scan span{animation:none}.qs-scan span{display:none}}
`;

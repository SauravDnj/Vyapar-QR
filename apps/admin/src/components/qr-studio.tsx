'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { fileSlug, loadBrandBadges, loadDesignFonts, loadImage, loadImageFile, saveBlob, type LoadedImage } from '../lib/qr-print/assets';
import { canvasToBlob, pdfFromCanvas, pdfFromQrArt } from '../lib/qr-print/pdf';
import { loadPlatformMarks, type LoadedPlatformMarks } from '../lib/qr-print/platform-marks';
import { DESIGNS, drawDesign, sheetHeight, type BrandBadge, type DesignKind, type DesignSpec } from '../lib/qr-print/posters';
import { DEFAULT_PRINT_THEME, PRINT_THEMES, isHex, paletteFrom, type PrintColours } from '../lib/qr-print/print-themes';
import { buildQrArt, qrArtToSvg } from '../lib/qr-print/qr-art';

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
  brand,
  label = null,
  fileBase,
}: {
  /** What the code encodes — the saved QR's own URL, so scans still count. */
  targetUrl: string;
  foreground: string | null;
  brand: StudioBrand;
  /** A promo code's label, e.g. "Table 5". */
  label?: string | null;
  fileBase: string;
}) {
  const [kind, setKind] = useState<DesignKind>('standee');
  // Keyed by the URL it was loaded from, so the state can never belong to a
  // logo that has since been changed.
  const [logoResult, setLogoResult] = useState<{ url: string; image: LoadedImage | null } | null>(null);
  const [logoAttempt, setLogoAttempt] = useState(0);
  // Whether the logo sits in the middle of the code in what gets downloaded.
  // Starts on whenever there is a logo: a code with the shop's mark in it is
  // recognised as theirs, and error correction H keeps it scannable.
  const [logoInCode, setLogoInCode] = useState(true);
  const [badges, setBadges] = useState<BrandBadge[]>([]);
  const [platform, setPlatform] = useState<LoadedPlatformMarks>({ left: null, right: null });
  const [ready, setReady] = useState(false);
  const [look, setLook] = useState<SavedLook>(readSavedLook);
  // A logo picked here, for print only — used when the page's own logo won't
  // load, or when the owner wants a different one on paper.
  const [printLogo, setPrintLogo] = useState<LoadedImage | null>(null);
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
      const [, loadedBadges, marks] = await Promise.all([
        loadDesignFonts(),
        loadBrandBadges(brandKey ? (brandKey.split(',') as BrandName[]) : []),
        loadPlatformMarks(),
      ]);
      if (cancelled) return;
      setBadges(loadedBadges);
      setPlatform(marks);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [brandKey]);

  useEffect(() => {
    if (!brand.logoUrl) return;
    let cancelled = false;
    const url = brand.logoUrl;
    void (async () => {
      const loaded = await loadImage(url);
      if (!cancelled) setLogoResult({ url, image: loaded });
    })();
    return () => {
      cancelled = true;
    };
  }, [brand.logoUrl, logoAttempt]);

  const pageLogo = logoResult?.url === brand.logoUrl ? logoResult.image : null;
  const logo = printLogo ?? pageLogo;
  /** 'none' when the business has no logo at all — then the monogram in the
   * designs is deliberate, not a failure. */
  const logoState: 'loading' | 'ready' | 'failed' | 'none' = printLogo
    ? 'ready'
    : !brand.logoUrl
      ? 'none'
      : logoResult?.url !== brand.logoUrl
        ? 'loading'
        : logoResult.image
          ? 'ready'
          : 'failed';

  const palette = useMemo(() => paletteFrom(look.colours), [look.colours]);

  function chooseLook(next: SavedLook) {
    setLook(next);
    setNotice(null);
    try {
      window.localStorage.setItem(LOOK_KEY, JSON.stringify(next));
    } catch {
      // Private mode: the choice lasts for this visit only.
    }
  }

  async function pickPrintLogo(file: File | undefined) {
    if (!file) return;
    try {
      setPrintLogo(await loadImageFile(file));
      setLogoInCode(true);
    } catch {
      setNotice({ tone: 'error', text: 'That file couldn’t be read as an image. Try a PNG or JPG.' });
    }
  }

  const spec = DESIGNS.find((design) => design.kind === kind) ?? DESIGNS[0]!;
  const qrLogo = logoInCode && logo ? logo.image : null;
  const ink = foreground ?? '#1c1917';

  // Two versions of the same code: the bare one keeps the standard four-module
  // margin; on a poster the white card around it supplies most of that margin.
  const arts = useMemo(() => {
    // The finder squares take the theme's colour, darkened by the palette
    // until a camera can find them on white.
    const accentInk = palette.mark;
    return {
      bare: buildQrArt(targetUrl, { foreground: ink, background: '#ffffff', withLogo: Boolean(qrLogo) }),
      card: buildQrArt(targetUrl, { foreground: ink, background: '#ffffff', eye: accentInk, withLogo: Boolean(qrLogo), quiet: 2 }),
    };
  }, [targetUrl, ink, qrLogo, palette.mark]);

  const content = useMemo(
    () => ({
      businessName: brand.businessName,
      tagline: brand.tagline,
      logo: logo?.image ?? null,
      address: brand.address,
      label,
      verbs: brand.verbs,
      brands: badges,
      platform: { left: platform.left?.image ?? null, right: platform.right?.image ?? null },
    }),
    [brand, logo, badges, label, platform],
  );

  function render(target: HTMLCanvasElement, design: DesignSpec, pixelWidth: number) {
    const ctx = target.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    target.width = Math.round(pixelWidth);
    target.height = Math.round((pixelWidth * sheetHeight(design)) / 1000);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);
    return drawDesign(ctx, design, pixelWidth, design.kind === 'qr' ? arts.bare : arts.card, qrLogo, content, palette);
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
  }, [ready, spec, arts, content, qrLogo, palette]);

  const formats: Format[] = kind === 'qr' ? ['png', 'jpg', 'svg', 'pdf'] : ['png', 'jpg', 'pdf'];
  // Downloading while the logo is still on its way is how a poster ends up
  // with a monogram where the logo should be.
  const waitingForLogo = logoState === 'loading';

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
                <DesignGlyph kind={design.kind} accent={palette.primary} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{design.name}</span>
                  <span className="text-xs text-muted">{design.use}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {kind === 'qr' ? null : <LookPicker look={look} onChange={chooseLook} />}

        <LogoRow
          logo={logo}
          state={logoState}
          fromDevice={printLogo !== null}
          onPick={(file) => void pickPrintLogo(file)}
          onClear={() => {
            setPrintLogo(null);
          }}
          onRetry={() => {
            setLogoAttempt((n) => n + 1);
          }}
        />

        <label className={`flex w-fit items-center gap-2 text-sm ${logo ? '' : 'text-muted'}`}>
          <input
            type="checkbox"
            checked={logoInCode && Boolean(logo)}
            disabled={!logo}
            onChange={(event) => {
              setLogoInCode(event.target.checked);
            }}
          />
          Put your logo in the middle of the code
        </label>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Download</p>
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <button
                key={format}
                type="button"
                disabled={!ready || busy !== null || waitingForLogo}
                onClick={() => void download(format)}
                className={`min-h-10 min-w-[4.5rem] cursor-pointer rounded-md px-4 text-sm font-medium disabled:cursor-default disabled:opacity-50 ${
                  format === formats[0] ? 'bg-accent text-accent-foreground' : 'border border-border-color'
                }`}
              >
                {busy === format ? 'Making…' : FORMAT_LABEL[format]}
              </button>
            ))}
          </div>
          {waitingForLogo ? <p className="text-xs text-muted">Loading your logo…</p> : null}
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

/** The colour look the sheets print in: a preset theme, or 'custom'. */
interface SavedLook {
  themeId: string;
  colours: PrintColours;
}

const LOOK_KEY = 'vyaparqr.print-look';

/** The last look picked on this device, or the default theme. */
function readSavedLook(): SavedLook {
  const fallback = { themeId: DEFAULT_PRINT_THEME.id, colours: DEFAULT_PRINT_THEME.colours };
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = JSON.parse(window.localStorage.getItem(LOOK_KEY) ?? 'null') as Partial<SavedLook> | null;
    const colours = saved?.colours;
    if (saved?.themeId && colours && isHex(colours.primary) && isHex(colours.trim) && isHex(colours.paper)) {
      return { themeId: saved.themeId, colours };
    }
  } catch {
    // Unreadable or blocked storage: start from the default.
  }
  return fallback;
}

const COLOUR_FIELDS: { key: keyof PrintColours; label: string; hint: string }[] = [
  { key: 'primary', label: 'Main colour', hint: 'The band and the code’s corners' },
  { key: 'trim', label: 'Trim', hint: 'The gold-style lines and rings' },
  { key: 'paper', label: 'Background', hint: 'The sheet itself' },
];

/**
 * Theme cards, then the three colours behind whichever is picked. Changing a
 * colour turns the look into "Custom", starting from the theme it was on, so
 * a small tweak never means starting over.
 */
function LookPicker({ look, onChange }: { look: SavedLook; onChange: (next: SavedLook) => void }) {
  const isCustom = look.themeId === 'custom';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium" id="qs-theme-label">
          Colour theme
        </p>
        {isCustom ? (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Custom colours</span>
        ) : null}
      </div>
      <div role="radiogroup" aria-labelledby="qs-theme-label" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PRINT_THEMES.map((theme) => {
          const selected = look.themeId === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                onChange({ themeId: theme.id, colours: theme.colours });
              }}
              className={`flex min-h-11 cursor-pointer flex-col gap-2 rounded-lg border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected ? 'border-accent ring-1 ring-accent' : 'border-border-color hover:border-accent/50'
              }`}
            >
              <ThemeSwatch colours={theme.colours} />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{theme.name}</span>
                <span className="truncate text-xs text-muted">{theme.mood}</span>
              </span>
            </button>
          );
        })}
      </div>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-border-color p-3">
        <legend className="px-1 text-xs font-medium text-muted">Fine-tune the colours</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {COLOUR_FIELDS.map((field) => (
            <ColourField
              key={field.key}
              label={field.label}
              hint={field.hint}
              value={look.colours[field.key]}
              onChange={(value) => {
                onChange({ themeId: 'custom', colours: { ...look.colours, [field.key]: value } });
              }}
            />
          ))}
        </div>
        <p className="text-xs text-muted">
          Text and the code’s corners are darkened automatically if a colour is too light to read or scan.
        </p>
      </fieldset>
    </div>
  );
}

/** A miniature of the sheet: paper, the band with its trim, and a code. */
function ThemeSwatch({ colours }: { colours: PrintColours }) {
  return (
    <svg viewBox="0 0 120 56" className="h-14 w-full rounded-md" aria-hidden="true" preserveAspectRatio="none">
      <rect width="120" height="56" fill={colours.paper} />
      <path d="M0 6 Q60 -2 120 6 V26 Q60 40 0 26 Z" fill={colours.primary} />
      <path d="M0 27.5 Q60 41.5 120 27.5" fill="none" stroke={colours.trim} strokeWidth="2.2" />
      <circle cx="60" cy="15" r="6" fill="#fff" stroke={colours.trim} strokeWidth="1.5" />
      <rect x="49" y="36" width="22" height="16" rx="2.5" fill="#fff" stroke={colours.trim} strokeWidth="1" />
      <rect x="52" y="39" width="4" height="4" fill={colours.primary} />
      <rect x="64" y="39" width="4" height="4" fill={colours.primary} />
      <rect x="52" y="45" width="4" height="4" fill={colours.primary} />
    </svg>
  );
}

/** A native colour picker with the hex beside it, which can be typed too. */
function ColourField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    // A theme card was picked: show its colour, not what was being typed.
    setLastValue(value);
    setDraft(value);
  }
  const id = `qs-colour-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className="h-11 w-11 shrink-0 cursor-pointer rounded-md border border-border-color bg-transparent p-0.5"
        />
        <input
          type="text"
          inputMode="text"
          spellCheck={false}
          aria-label={`${label} hex code`}
          value={draft}
          maxLength={7}
          onChange={(event) => {
            const next = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`;
            setDraft(next);
            if (isHex(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => {
            setDraft(value);
          }}
          className="h-11 w-full min-w-0 rounded-md border border-border-color bg-transparent px-2 font-mono text-sm uppercase"
        />
      </div>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

/**
 * Which logo the sheets print, and a way to pick one from the device when the
 * page's own logo won't load — the monogram is never the only way out.
 */
function LogoRow({
  logo,
  state,
  fromDevice,
  onPick,
  onClear,
  onRetry,
}: {
  logo: LoadedImage | null;
  state: 'loading' | 'ready' | 'failed' | 'none';
  fromDevice: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
  onRetry: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const message = fromDevice
    ? 'Using the logo you picked, for these prints only.'
    : state === 'ready'
      ? 'Your page’s logo.'
      : state === 'loading'
        ? 'Loading your logo…'
        : state === 'failed'
          ? 'Your logo couldn’t be loaded, so the designs show your initials.'
          : 'No logo on your page yet, so the designs show your initials.';
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Logo</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-color bg-white">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.dataUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-muted">{state === 'loading' ? '…' : 'Aa'}</span>
          )}
        </span>
        <p role={state === 'failed' ? 'alert' : undefined} className={`min-w-0 flex-1 text-sm ${state === 'failed' ? 'text-warning' : 'text-muted'}`}>
          {message}
        </p>
        <div className="flex flex-wrap gap-2">
          {state === 'failed' && !fromDevice ? (
            <button type="button" onClick={onRetry} className="min-h-10 cursor-pointer rounded-md border border-border-color px-3 text-sm">
              Try again
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="min-h-10 cursor-pointer rounded-md border border-border-color px-3 text-sm"
          >
            {logo ? 'Use a different logo' : 'Upload logo'}
          </button>
          {fromDevice ? (
            <button type="button" onClick={onClear} className="min-h-10 cursor-pointer rounded-md px-3 text-sm text-muted underline">
              Use page logo
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(event) => {
            onPick(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      <p className="text-xs text-muted">To change the logo on your page as well, upload it under My Landing Page.</p>
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

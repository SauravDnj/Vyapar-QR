import { contrast, drawCover, drawQrArt, mix, type QrArt } from './qr-art';

/**
 * The printable designs, drawn on a canvas.
 *
 * Every design is laid out on a sheet 1000 units wide, so the preview and the
 * 300-dpi print file are the same drawing at two scales. They take the landing
 * page's own look — its accent colour, Cormorant for the name, Montserrat for
 * the small print, the logo in the same ringed circle — so the card on the
 * counter and the page it opens look like one brand.
 *
 * The QR code is the subject of every design: the biggest thing on the sheet,
 * on its own white card with a quiet margin, framed by corner marks that say
 * "point here". Everything else is arranged around it in reading order — who
 * this is, what scanning does, how to do it — and nothing crowds the code.
 */

export type DesignKind = 'qr' | 'standee' | 'poster' | 'sticker';

export interface DesignSpec {
  kind: DesignKind;
  name: string;
  use: string;
  /** Print size. */
  widthMm: number;
  heightMm: number;
  /** Pixels in the PNG / JPG: 300 dpi at the print size. */
  widthPx: number;
  heightPx: number;
}

export const DESIGNS: DesignSpec[] = [
  { kind: 'standee', name: 'Table standee', use: '4 × 6 in · counter or table', widthMm: 101.6, heightMm: 152.4, widthPx: 1200, heightPx: 1800 },
  { kind: 'poster', name: 'A4 poster', use: '210 × 297 mm · wall or window', widthMm: 210, heightMm: 297, widthPx: 2480, heightPx: 3508 },
  { kind: 'sticker', name: 'Square sticker', use: '100 × 100 mm · door, desk or WhatsApp status', widthMm: 100, heightMm: 100, widthPx: 1500, heightPx: 1500 },
  { kind: 'qr', name: 'QR code only', use: 'Just the code, for your own designs', widthMm: 80, heightMm: 80, widthPx: 2048, heightPx: 2048 },
];

export interface BrandBadge {
  image: CanvasImageSource;
  /** width ÷ height */
  aspect: number;
}

export interface DesignContent {
  businessName: string;
  tagline: string;
  /** The page's logo, already loaded; null draws a monogram instead. */
  logo: CanvasImageSource | null;
  accent: string;
  /** Short form of the page address, e.g. "qrhub-landing.vercel.app/site/waloop". */
  address: string;
  /** A promo code's label ("Table 5"), printed as a tag. */
  label: string | null;
  /** What scanning does, in order: "Pay", "Review", "Chat". */
  verbs: string[];
  brands: BrandBadge[];
}

/** Where the QR code landed, as fractions of the sheet — the preview lays its
 * scan-line animation over exactly this square. */
export interface QrPlacement {
  x: number;
  y: number;
  size: number;
}

export const DISPLAY_FONT = '"Cormorant", "Cormorant Garamond", Georgia, serif';
export const BODY_FONT = '"Montserrat", ui-sans-serif, system-ui, sans-serif';

const TEXT = '#1c1917';
const MUTED = '#57534e';
const SOFT = '#78716c';

/** Units per sheet width. */
const W = 1000;

export function sheetHeight(spec: DesignSpec): number {
  return (W * spec.heightPx) / spec.widthPx;
}

/**
 * Draws one design onto `ctx`, which is `pixelWidth` pixels wide. Returns the
 * QR code's placement.
 */
export function drawDesign(
  ctx: CanvasRenderingContext2D,
  spec: DesignSpec,
  pixelWidth: number,
  art: QrArt,
  qrLogo: CanvasImageSource | null,
  content: DesignContent,
): QrPlacement {
  const scale = pixelWidth / W;
  const H = sheetHeight(spec);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';
  const palette = paletteFor(content.accent);
  const kit: Kit = { ctx, scale, palette, art, qrLogo, content, H };

  let qr: QrPlacement;
  switch (spec.kind) {
    case 'standee':
      qr = drawStandee(kit);
      break;
    case 'poster':
      qr = drawPoster(kit);
      break;
    case 'sticker':
      qr = drawSticker(kit);
      break;
    case 'qr':
      drawQrArt(ctx, art, 0, 0, W, qrLogo);
      qr = { x: 0, y: 0, size: W };
      break;
  }
  ctx.restore();
  return { x: qr.x / W, y: qr.y / H, size: qr.size / W };
}

interface Palette {
  accent: string;
  /** The accent darkened until it carries small text on white. */
  ink: string;
  deep: string;
  tint: string;
  edge: string;
  /** Text that sits on the accent. */
  onAccent: string;
  /** Gold-ish light used in the logo ring and highlights. */
  shine: string;
  /** Corner marks and small fills on white: the accent, unless it is too
   * pale to see there. */
  mark: string;
}

function paletteFor(accent: string): Palette {
  let ink = mix(accent, '#2b1a02', 0.18);
  for (let step = 0; step < 6 && contrast(ink, '#ffffff') < 4.8; step += 1) ink = mix(ink, '#1c1208', 0.25);
  return {
    accent,
    ink,
    deep: mix(accent, '#120b02', 0.42),
    tint: mix(accent, '#ffffff', 0.9),
    edge: mix(accent, '#ffffff', 0.78),
    onAccent: contrast('#ffffff', accent) >= 3 ? '#ffffff' : TEXT,
    shine: mix(accent, '#fff4d6', 0.62),
    mark: contrast(accent, '#ffffff') >= 2.2 ? accent : mix(accent, '#2b1a02', 0.35),
  };
}

interface Kit {
  ctx: CanvasRenderingContext2D;
  scale: number;
  palette: Palette;
  art: QrArt;
  qrLogo: CanvasImageSource | null;
  content: DesignContent;
  H: number;
}

/* ─── Table standee · 4 × 6 in ─────────────────────────────────────────── */

function drawStandee(kit: Kit): QrPlacement {
  const { ctx, palette: p, content, H } = kit;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  softGlow(ctx, 500, 360, 620, p.tint);

  // The arch: accent from edge to edge, curving down to cradle the logo.
  const archBottom = 300;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, archBottom - 30);
  ctx.quadraticCurveTo(500, archBottom + 110, 0, archBottom - 30);
  ctx.closePath();
  const band = ctx.createLinearGradient(0, 0, W, archBottom);
  band.addColorStop(0, p.accent);
  band.addColorStop(1, p.deep);
  ctx.fillStyle = band;
  ctx.fill();
  ctx.clip();
  rings(ctx, 500, archBottom + 40, p.onAccent, 0.09);
  ctx.restore();

  spaced(ctx, content.label ? content.label.toUpperCase() : 'WELCOME', 500, 92, `600 24px ${BODY_FONT}`, withAlpha(p.onAccent, 0.82), 6);
  diamondRule(ctx, 500, 122, 150, withAlpha(p.onAccent, 0.55));

  logoDisc(kit, 500, archBottom + 50, 104);

  let y = archBottom + 50 + 104 + 86;
  y = nameBlock(ctx, content.businessName, 500, y, 840, 80, 50, TEXT);
  if (content.tagline) {
    y += 10;
    y = fitOneLine(ctx, content.tagline, 500, y + 30, 820, `500 {s}px ${BODY_FONT}`, 27, 19, MUTED) + 4;
  }

  y += 52;
  eyebrow(ctx, `SCAN TO ${content.verbs.join(' · ').toUpperCase()}`, 500, y, p);

  // The code takes whatever height is left once everything under it is
  // placed: the pill (overlapping the card), the logo row and the address.
  const addressY = H - 46;
  const below = 40 + 56 + (content.brands.length > 0 ? 64 : 0) + 18;
  const room = addressY - below - (y + 34);
  const qrSize = clamp(room / 1.075 - 20, 400, 620);
  const qrTop = y + 34 + qrSize * 0.075 + 12;
  const qr = qrCard(kit, 500 - qrSize / 2, qrTop, qrSize);
  const pillY = qrTop + qrSize + qrSize * 0.075;
  pill(ctx, 'Scan with your phone camera', 500, pillY, p);

  if (content.brands.length > 0) {
    brandRow(ctx, content.brands, 500, (pillY + 32 + addressY - 26) / 2, 40, 880);
  }
  fitOneLine(ctx, content.address, 500, addressY, 860, `500 {s}px ${BODY_FONT}`, 19, 13, SOFT);

  ctx.fillStyle = p.accent;
  ctx.fillRect(0, H - 14, W, 14);
  return qr;
}

/* ─── A4 poster ────────────────────────────────────────────────────────── */

function drawPoster(kit: Kit): QrPlacement {
  const { ctx, palette: p, content, H } = kit;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  softGlow(ctx, 500, 0, 820, p.tint);

  // A fine double frame with diamonds at the corners, the way a printed
  // certificate or a jeweller's box card is edged.
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(34, 34, W - 68, H - 68);
  ctx.strokeStyle = withAlpha(p.accent, 0.45);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  for (const [cx, cy] of [
    [34, 34],
    [W - 34, 34],
    [34, H - 34],
    [W - 34, H - 34],
  ] as const) {
    diamond(ctx, cx, cy, 13, p.accent);
    diamond(ctx, cx, cy, 5, '#ffffff');
  }

  if (content.label) tag(ctx, content.label, 500, 104, p);

  // A promo label sits above the logo, so the logo moves down to make room.
  const logoY = content.label ? 226 : 178;
  logoDisc(kit, 500, logoY, 70);
  let y = logoY + 70 + 72;
  y = nameBlock(ctx, content.businessName, 500, y, 780, 66, 42, TEXT);
  if (content.tagline) {
    y = fitOneLine(ctx, content.tagline, 500, y + 44, 760, `500 {s}px ${BODY_FONT}`, 22, 16, MUTED);
  }
  y += 34;
  diamondRule(ctx, 500, y, 260, p.accent);
  y += 80;
  const headline = `Scan to ${joinAnd(content.verbs.slice(0, 2))}`;
  fitOneLine(ctx, headline, 500, y, 820, `600 {s}px ${DISPLAY_FONT}`, 84, 54, p.ink);

  // Laid out from the frame upwards — address, logo row, the three steps —
  // so those always fit; the code gets the height that is left, centred in it.
  const addressY = H - 88;
  const hasBrands = content.brands.length > 0;
  const brandsY = addressY - 58;
  const stepsTextY = hasBrands ? brandsY - 62 : addressY - 60;
  const stepsY = stepsTextY - 66;
  const top = y + 46;
  const bottom = stepsY - 70;
  const qrSize = clamp((bottom - top) / 1.15, 300, 600);
  const qrTop = top + (bottom - top - qrSize * 1.15) / 2 + qrSize * 0.075;
  const qr = qrCard(kit, 500 - qrSize / 2, qrTop, qrSize);

  // How to, in three steps — for the customer who has never scanned a code.
  const steps = ['Open your camera', 'Point it at the code', `Tap to ${content.verbs[0]?.toLowerCase() ?? 'open'}`];
  steps.forEach((text, index) => {
    const cx = 500 + (index - 1) * 280;
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(cx, stepsY, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.onAccent;
    ctx.font = `700 26px ${BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(index + 1), cx, stepsY + 9);
    fitOneLine(ctx, text, cx, stepsY + 66, 250, `600 {s}px ${BODY_FONT}`, 21, 15, TEXT);
    if (index < steps.length - 1) {
      ctx.strokeStyle = p.edge;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 8]);
      ctx.beginPath();
      ctx.moveTo(cx + 48, stepsY);
      ctx.lineTo(cx + 232, stepsY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  if (hasBrands) brandRow(ctx, content.brands, 500, brandsY, 40, 780);
  fitOneLine(ctx, content.address, 500, addressY, 780, `500 {s}px ${BODY_FONT}`, 19, 13, SOFT);
  return qr;
}

/* ─── Square sticker ───────────────────────────────────────────────────── */

function drawSticker(kit: Kit): QrPlacement {
  const { ctx, palette: p, content, H } = kit;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, p.accent);
  bg.addColorStop(1, p.deep);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  softGlow(ctx, 500, 120, 560, withAlpha('#ffffff', 0.16));
  ctx.save();
  rings(ctx, 500, 500, p.onAccent, 0.07);
  ctx.restore();

  const title = content.label ? `${content.businessName} · ${content.label}` : content.businessName;
  const titleEnd = nameBlock(ctx, title, 500, 100, 860, 66, 40, p.onAccent);

  // A name that needs two lines pushes the code down; the code shrinks to fit.
  const qrSize = clamp((H - 222 - (titleEnd + 40)) / 1.075, 440, 570);
  const qrTop = titleEnd + 40 + qrSize * 0.075;
  const qr = qrCard(kit, 500 - qrSize / 2, qrTop, qrSize, { onColour: true });
  const after = qrTop + qrSize + qrSize * 0.075;

  spaced(ctx, 'SCAN ME', 500, after + 82, `700 50px ${BODY_FONT}`, p.onAccent, 14);
  const verbs = content.verbs.join(' · ');
  fitOneLine(ctx, verbs, 500, after + 134, 800, `500 {s}px ${BODY_FONT}`, 24, 16, withAlpha(p.onAccent, 0.82));
  return qr;
}

/* ─── Shared pieces ────────────────────────────────────────────────────── */

/** The QR on its white card, with corner marks. Returns its placement. */
function qrCard(kit: Kit, x: number, y: number, size: number, { onColour = false } = {}): QrPlacement {
  const { ctx, palette: p, art, qrLogo, scale } = kit;
  const pad = size * 0.075;
  const card = { x: x - pad, y: y - pad, w: size + pad * 2, h: size + pad * 2 };

  ctx.save();
  ctx.shadowColor = onColour ? 'rgba(10, 6, 0, 0.35)' : withAlpha(p.deep, 0.22);
  ctx.shadowBlur = 46 * scale;
  ctx.shadowOffsetY = 18 * scale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(card.x, card.y, card.w, card.h, 38);
  ctx.fill();
  ctx.restore();
  if (!onColour) {
    ctx.strokeStyle = p.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(card.x, card.y, card.w, card.h, 38);
    ctx.stroke();
  }

  drawQrArt(ctx, art, x, y, size, qrLogo);

  // Corner marks just outside the code: the viewfinder a camera app shows.
  const arm = size * 0.12;
  const gap = pad * 0.45;
  ctx.strokeStyle = p.mark;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const [cx, cy, dx, dy] of [
    [x - gap, y - gap, 1, 1],
    [x + size + gap, y - gap, -1, 1],
    [x - gap, y + size + gap, 1, -1],
    [x + size + gap, y + size + gap, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * arm);
    ctx.lineTo(cx, cy + dy * 10);
    ctx.quadraticCurveTo(cx, cy, cx + dx * 10, cy);
    ctx.lineTo(cx + dx * arm, cy);
    ctx.stroke();
  }
  return { x, y, size };
}

/** The logo in the same ringed white circle the landing page uses. */
function logoDisc(kit: Kit, cx: number, cy: number, r: number) {
  const { ctx, palette: p, content, scale } = kit;
  ctx.save();
  ctx.shadowColor = 'rgba(60, 42, 12, 0.28)';
  ctx.shadowBlur = 34 * scale;
  ctx.shadowOffsetY = 14 * scale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ring.addColorStop(0, p.accent);
  ring.addColorStop(0.4, p.shine);
  ring.addColorStop(0.72, p.accent);
  ring.addColorStop(1, p.shine);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (content.logo) {
    drawCover(ctx, content.logo, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = p.tint;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = p.ink;
    ctx.font = `600 ${String(Math.round(r * 0.8))}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(initials(content.businessName), cx, cy + r * 0.28);
  }
  ctx.restore();
}

/** The business name, up to two lines, shrunk to fit. Returns the baseline
 * of its last line. */
function nameBlock(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxWidth: number, size: number, min: number, colour: string): number {
  const { lines, size: used } = fitLines(ctx, text, (s) => `600 ${String(s)}px ${DISPLAY_FONT}`, maxWidth, size, min, 2);
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.font = `600 ${String(used)}px ${DISPLAY_FONT}`;
  lines.forEach((line, index) => {
    ctx.fillText(line, cx, y + index * used * 1.02);
  });
  return y + (lines.length - 1) * used * 1.02;
}

/** Small spaced capitals between two hairlines ending in diamonds. */
function eyebrow(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, p: Palette) {
  const font = `600 21px ${BODY_FONT}`;
  ctx.font = font;
  ctx.letterSpacing = '4px';
  const width = Math.min(ctx.measureText(text).width, 700);
  ctx.letterSpacing = '0px';
  fitOneLine(ctx, text, cx, y, 700, `600 {s}px ${BODY_FONT}`, 21, 15, p.ink, 4);
  const half = width / 2 + 26;
  for (const dir of [-1, 1]) {
    const grad = ctx.createLinearGradient(cx + dir * half, 0, cx + dir * (half + 70), 0);
    grad.addColorStop(0, p.accent);
    grad.addColorStop(1, withAlpha(p.accent, 0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + dir * half, y - 7);
    ctx.lineTo(cx + dir * (half + 70), y - 7);
    ctx.stroke();
    diamond(ctx, cx + dir * (half - 10), y - 7, 5, p.accent);
  }
}

function diamondRule(ctx: CanvasRenderingContext2D, cx: number, y: number, width: number, colour: string) {
  for (const dir of [-1, 1]) {
    const grad = ctx.createLinearGradient(cx + dir * 16, 0, cx + (dir * width) / 2, 0);
    grad.addColorStop(0, colour);
    grad.addColorStop(1, withAlpha(colour, 0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + dir * 16, y);
    ctx.lineTo(cx + (dir * width) / 2, y);
    ctx.stroke();
  }
  diamond(ctx, cx, y, 7, colour);
}

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, p: Palette) {
  ctx.font = `600 24px ${BODY_FONT}`;
  const width = ctx.measureText(text).width + 110;
  const height = 64;
  const grad = ctx.createLinearGradient(0, cy - height / 2, 0, cy + height / 2);
  grad.addColorStop(0, p.accent);
  grad.addColorStop(1, mix(p.accent, '#000000', 0.16));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, cy - height / 2, width, height, height / 2);
  ctx.fill();
  cameraIcon(ctx, cx - width / 2 + 44, cy, 15, p.onAccent);
  ctx.fillStyle = p.onAccent;
  ctx.textAlign = 'left';
  ctx.fillText(text, cx - width / 2 + 74, cy + 9);
}

function tag(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, p: Palette) {
  ctx.font = `700 22px ${BODY_FONT}`;
  ctx.letterSpacing = '3px';
  const label = text.toUpperCase();
  const width = Math.min(ctx.measureText(label).width + 56, 700);
  ctx.fillStyle = p.tint;
  ctx.strokeStyle = p.edge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, cy - 26, width, 52, 26);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.ink;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + 8, width - 40);
  ctx.letterSpacing = '0px';
}

/** The logos of what the page offers, centred in one row. */
function brandRow(ctx: CanvasRenderingContext2D, brands: BrandBadge[], cx: number, y: number, height: number, maxWidth: number) {
  const gap = height * 0.9;
  let h = height;
  let total = brands.reduce((sum, badge) => sum + badge.aspect * h, 0) + gap * (brands.length - 1);
  if (total > maxWidth) {
    h *= maxWidth / total;
    total = maxWidth;
  }
  let x = cx - total / 2;
  for (const badge of brands) {
    const w = badge.aspect * h;
    ctx.drawImage(badge.image, x, y - h / 2, w, h);
    x += w + (gap * h) / height;
  }
}

function spaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, font: string, colour: string, spacing: number) {
  ctx.font = font;
  ctx.letterSpacing = `${String(spacing)}px`;
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  // Letter spacing adds a trailing gap; nudge right so the text stays centred.
  ctx.fillText(text, cx + spacing / 2, y);
  ctx.letterSpacing = '0px';
}

/** One line, shrunk to fit, then ellipsised if even the minimum won't. */
function fitOneLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  fontTemplate: string,
  size: number,
  min: number,
  colour: string,
  spacing = 0,
): number {
  let used = size;
  ctx.letterSpacing = `${String(spacing)}px`;
  const font = (s: number) => fontTemplate.replace('{s}', String(s));
  ctx.font = font(used);
  while (used > min && ctx.measureText(text).width > maxWidth) {
    used -= 1;
    ctx.font = font(used);
  }
  let shown = text;
  while (shown.length > 1 && ctx.measureText(shown).width > maxWidth) {
    shown = `${shown.slice(0, -2).trimEnd()}…`;
  }
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.fillText(shown, cx + spacing / 2, y);
  ctx.letterSpacing = '0px';
  return y;
}

/** Breaks `text` into at most `maxLines` lines no wider than `maxWidth`,
 * shrinking the size first. */
export function fitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  maxWidth: number,
  size: number,
  min: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const words = text.trim().split(/\s+/);
  for (let s = size; s >= min; s -= 2) {
    ctx.font = font(s);
    const lines = wrap(ctx, words, maxWidth);
    if (lines.length <= maxLines && lines.every((line) => ctx.measureText(line).width <= maxWidth)) {
      return { lines, size: s };
    }
  }
  ctx.font = font(min);
  const lines = wrap(ctx, words, maxWidth).slice(0, maxLines);
  const last = lines.length - 1;
  while ((lines[last] ?? '').length > 1 && ctx.measureText(lines[last] ?? '').width > maxWidth) {
    lines[last] = `${(lines[last] ?? '').slice(0, -2).trimEnd()}…`;
  }
  return { lines, size: min };
}

function wrap(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function softGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, colour: string) {
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0, colour);
  glow.addColorStop(1, withAlpha(colour, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/** Fine concentric rings — a quiet texture behind the colour band. */
function rings(ctx: CanvasRenderingContext2D, cx: number, cy: number, colour: string, alpha: number) {
  ctx.strokeStyle = withAlpha(colour, alpha);
  ctx.lineWidth = 1.5;
  for (let r = 120; r < 1100; r += 46) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, colour: string) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}

function cameraIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, colour: string) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(cx - r * 1.2, cy - r * 0.75, r * 2.4, r * 1.7, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy - r * 0.75);
  ctx.lineTo(cx - r * 0.3, cy - r * 1.1);
  ctx.lineTo(cx + r * 0.3, cy - r * 1.1);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.1, r * 0.48, 0, Math.PI * 2);
  ctx.stroke();
}

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return letters || 'Q';
}

function joinAnd(words: string[]): string {
  if (words.length <= 1) return (words[0] ?? 'connect').toLowerCase();
  return `${words.slice(0, -1).join(', ').toLowerCase()} & ${(words.at(-1) ?? '').toLowerCase()}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  return `rgba(${String((value >> 16) & 255)}, ${String((value >> 8) & 255)}, ${String(value & 255)}, ${String(alpha)})`;
}

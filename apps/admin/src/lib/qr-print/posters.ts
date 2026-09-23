import { PLATFORM_MARKS } from './platform-marks';
import { drawCover, drawQrArt, type QrArt } from './qr-art';

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
  /** Short form of the page address, e.g. "qr.waloop.in/site/waloop". */
  address: string;
  /** A promo code's label ("Table 5"), printed as a tag. */
  label: string | null;
  /** What scanning does, in order: "Pay", "Review", "Chat". */
  verbs: string[];
  brands: BrandBadge[];
  /** The platform's marks along the top: Waloop left, Meta partner right.
   * Either may be null, and a labelled placeholder is drawn instead. */
  platform: { left: CanvasImageSource | null; right: CanvasImageSource | null };
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
  const palette = PALETTE;
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
  /** The blue darkened until it carries small text on white. */
  ink: string;
  deep: string;
  tint: string;
  edge: string;
  /** Text that sits on the blue. */
  onAccent: string;
  /** The lighter blue used in the logo ring and highlights. */
  shine: string;
  /** Facebook blue, for the second stop of a gradient. */
  sky: string;
  /** Corner marks and small fills on white: the accent, unless it is too
   * pale to see there. */
  mark: string;
}

/**
 * The print template's own colours: Meta blue with Facebook blue and a light
 * sky behind it — the same blues the product uses on screen.
 *
 * Fixed, not taken from each business's accent colour, because these sheets
 * carry the platform's marks at the top and have to look like one family
 * wherever they are printed. `ink` is the blue darkened until 12px text on
 * white clears 4.5:1.
 */
export const BRAND = {
  accent: '#0866ff',
  ink: '#0b46b8',
  deep: '#062c86',
  sky: '#1877f2',
  tint: '#eaf2ff',
  edge: '#bcd6ff',
  onAccent: '#ffffff',
  shine: '#8fc0ff',
} as const;

const PALETTE: Palette = { ...BRAND, mark: BRAND.accent };

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

  // The blue band: edge to edge, curving down to cradle the logo. Deeper at
  // the sides, Facebook blue through the middle.
  const archBottom = 330;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, archBottom - 30);
  ctx.quadraticCurveTo(500, archBottom + 110, 0, archBottom - 30);
  ctx.closePath();
  const band = ctx.createLinearGradient(0, 0, 0, archBottom + 110);
  band.addColorStop(0, p.sky);
  band.addColorStop(0.55, p.accent);
  band.addColorStop(1, p.deep);
  ctx.fillStyle = band;
  ctx.fill();
  // A soft highlight behind the logo, so the band reads as lit from above.
  softGlow(ctx, 500, 40, 520, withAlpha('#ffffff', 0.18));
  ctx.clip();
  rings(ctx, 500, archBottom + 40, p.onAccent, 0.1);
  ctx.restore();

  platformRow(kit, 56, 62, true);
  spaced(
    ctx,
    content.label ? content.label.toUpperCase() : 'SCAN ME',
    500,
    182,
    `600 24px ${BODY_FONT}`,
    withAlpha(p.onAccent, 0.9),
    6,
  );
  diamondRule(ctx, 500, 212, 150, withAlpha(p.onAccent, 0.6));

  logoDisc(kit, 500, archBottom + 46, 100);

  let y = archBottom + 46 + 100 + 82;
  y = nameBlock(ctx, content.businessName, 500, y, 840, 76, 48, TEXT);
  if (content.tagline) {
    y = fitOneLine(ctx, content.tagline, 500, y + 40, 820, `500 {s}px ${BODY_FONT}`, 26, 18, MUTED);
  }

  y += 50;
  eyebrow(ctx, `SCAN TO ${content.verbs.join(' · ').toUpperCase()}`, 500, y, p);

  // Everything under the code is placed first — the pill that overlaps the
  // card, the app logos, the address — and the code is then centred in the
  // band that is left, which is what puts it in the middle of the sheet.
  const addressY = H - 46;
  const brandsY = content.brands.length > 0 ? addressY - 62 : addressY;
  const top = y + 30;
  const bottom = brandsY - (content.brands.length > 0 ? 54 : 34) - 34;
  const qrSize = clamp((bottom - top) / 1.22, 380, 680);
  const qrTop = top + (bottom - top - qrSize * 1.22) / 2 + qrSize * 0.075;
  const qr = qrCard(kit, 500 - qrSize / 2, qrTop, qrSize);
  pill(ctx, 'Scan with your phone camera', 500, qrTop + qrSize + qrSize * 0.075, p);

  if (content.brands.length > 0) {
    brandRow(ctx, content.brands, 500, brandsY, 40, 880);
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
  ctx.strokeStyle = withAlpha(p.sky, 0.45);
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

  // The platform's marks sit inside the frame, above everything else.
  platformRow(kit, 74, 60, false);
  if (content.label) tag(ctx, content.label, 500, 196, p);

  const logoY = content.label ? 282 : 230;
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
  const qrSize = clamp((bottom - top) / 1.15, 300, 660);
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

/**
 * The platform's marks across the top: Waloop on the left, the Meta partner
 * badge on the right, each on a white chip so a coloured logo reads against
 * the blue. Until the image files exist, the chip holds its name instead, so
 * the sheet is never missing a corner.
 */
function platformRow(kit: Kit, y: number, height: number, onColour: boolean) {
  const { ctx, palette: p, content } = kit;
  const width = height * PLATFORM_MARKS.left.aspect;
  const inset = 64;
  const slots = [
    { mark: PLATFORM_MARKS.left, image: content.platform.left, x: inset },
    { mark: PLATFORM_MARKS.right, image: content.platform.right, x: W - inset - width },
  ];

  for (const slot of slots) {
    ctx.fillStyle = onColour ? withAlpha('#ffffff', 0.96) : '#ffffff';
    ctx.strokeStyle = onColour ? withAlpha('#ffffff', 0.5) : p.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(slot.x, y, width, height, height * 0.32);
    ctx.fill();
    ctx.stroke();

    const pad = height * 0.18;
    if (slot.image) {
      drawContain(ctx, slot.image, slot.x + pad, y + pad, width - pad * 2, height - pad * 2);
      continue;
    }
    // Placeholder: the name, and a hairline that says this is a slot.
    const hasSub = Boolean(slot.mark.sub);
    fitOneLine(
      ctx,
      slot.mark.label,
      slot.x + width / 2,
      y + height * (hasSub ? 0.46 : 0.62),
      width - pad * 3,
      `700 {s}px ${BODY_FONT}`,
      Math.round(height * 0.3),
      11,
      p.ink,
      2,
    );
    if (slot.mark.sub) {
      fitOneLine(
        ctx,
        slot.mark.sub,
        slot.x + width / 2,
        y + height * 0.78,
        width - pad * 2,
        `500 {s}px ${BODY_FONT}`,
        Math.round(height * 0.2),
        9,
        MUTED,
      );
    }
  }
}

/** Like CSS `object-fit: contain` — a logo must not be cropped. */
function drawContain(ctx: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const size = image instanceof HTMLImageElement ? { width: image.naturalWidth, height: image.naturalHeight } : { width: 0, height: 0 };
  if (!size.width || !size.height) return;
  const scale = Math.min(w / size.width, h / size.height);
  const drawW = size.width * scale;
  const drawH = size.height * scale;
  ctx.drawImage(image, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

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
  grad.addColorStop(0, p.sky);
  grad.addColorStop(1, p.accent);
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

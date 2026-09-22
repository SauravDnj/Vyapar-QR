import QRCode from 'qrcode';

/**
 * The QR code as a list of shapes, in module units, so one drawing feeds every
 * format: the canvas behind PNG and JPG, the SVG file and the PDF. They used
 * to come from three places (a PNG and an SVG rendered on the server, a PDF
 * rebuilt from that PNG) and only the SVG could carry the logo.
 *
 * Plain square data modules, because every phone camera reads those; only the
 * three finder "eyes" are rounded, which scanners tolerate and which is where
 * the code gets its look. A logo clears a centred block and switches the code
 * to error correction H, so up to 30% of it can be covered and it still reads.
 */

export interface QrRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius, in modules. */
  r: number;
  color: string;
}

export interface QrArt {
  /** Width and height in modules, quiet zone included. */
  size: number;
  background: string;
  rects: QrRect[];
  /** Where the logo goes, in modules; null without one. */
  logo: { x: number; y: number; size: number } | null;
}

export interface QrArtOptions {
  foreground: string;
  background: string;
  /** Finder colour; falls back to the foreground when it wouldn't read. */
  eye?: string;
  withLogo: boolean;
  /** Blank modules around the code. Four is the standard's minimum on paper;
   * a poster that puts the code on its own white card can use less. */
  quiet?: number;
}

export function buildQrArt(text: string, options: QrArtOptions): QrArt {
  const code = QRCode.create(text, { errorCorrectionLevel: options.withLogo ? 'H' : 'M' });
  const n = code.modules.size;
  const quiet = options.quiet ?? 4;
  const fg = options.foreground;
  const bg = options.background;
  const eye = options.eye && contrast(options.eye, bg) >= 3.2 ? options.eye : fg;
  const dark = (row: number, col: number) => Boolean(code.modules.get(row, col));

  const inFinder = (row: number, col: number) =>
    (row < 7 && col < 7) || (row < 7 && col >= n - 7) || (row >= n - 7 && col < 7);

  // An odd number of modules, about a fifth of the code: comfortably inside
  // what level H recovers, big enough for the logo to be recognisable.
  let clear = 0;
  if (options.withLogo) {
    clear = Math.round(n * 0.22);
    if (clear % 2 === 0) clear += 1;
  }
  const clearStart = (n - clear) / 2;
  const inClear = (row: number, col: number) =>
    clear > 0 &&
    row >= clearStart - 1 &&
    row < clearStart + clear + 1 &&
    col >= clearStart - 1 &&
    col < clearStart + clear + 1;
  const skip = (row: number, col: number) => !dark(row, col) || inFinder(row, col) || inClear(row, col);

  const rects: QrRect[] = [];
  for (let row = 0; row < n; row += 1) {
    let col = 0;
    while (col < n) {
      if (skip(row, col)) {
        col += 1;
        continue;
      }
      // Runs are merged so the SVG and PDF stay small; the joins are exact.
      let end = col;
      while (end + 1 < n && !skip(row, end + 1)) end += 1;
      rects.push({ x: quiet + col, y: quiet + row, w: end - col + 1, h: 1, r: 0, color: fg });
      col = end + 1;
    }
  }

  const finders: [number, number][] = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];
  for (const [row, col] of finders) {
    const x = quiet + col;
    const y = quiet + row;
    rects.push({ x, y, w: 7, h: 7, r: 2.2, color: eye });
    rects.push({ x: x + 1, y: y + 1, w: 5, h: 5, r: 1.4, color: bg });
    rects.push({ x: x + 2, y: y + 2, w: 3, h: 3, r: 0.9, color: eye });
  }

  return {
    size: n + quiet * 2,
    background: bg,
    rects,
    logo: clear > 0 ? { x: quiet + clearStart, y: quiet + clearStart, size: clear } : null,
  };
}

/** Draws the code into a square at (x, y) of `px` pixels. */
export function drawQrArt(
  ctx: CanvasRenderingContext2D,
  art: QrArt,
  x: number,
  y: number,
  px: number,
  logo: CanvasImageSource | null,
) {
  const unit = px / art.size;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = art.background;
  ctx.fillRect(0, 0, px, px);
  for (const rect of art.rects) {
    ctx.fillStyle = rect.color;
    if (rect.r === 0) {
      // A hair of overlap closes the seams anti-aliasing leaves between rows.
      ctx.fillRect(rect.x * unit - 0.3, rect.y * unit - 0.3, rect.w * unit + 0.6, rect.h * unit + 0.6);
    } else {
      ctx.beginPath();
      ctx.roundRect(rect.x * unit, rect.y * unit, rect.w * unit, rect.h * unit, rect.r * unit);
      ctx.fill();
    }
  }
  if (art.logo && logo) {
    const { x: lx, y: ly, size } = art.logo;
    const cx = (lx + size / 2) * unit;
    const cy = (ly + size / 2) * unit;
    const radius = (size / 2) * unit;
    const inner = radius * 0.86;
    ctx.fillStyle = art.background;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, logo, cx - inner, cy - inner, inner * 2, inner * 2);
    ctx.restore();
  }
  ctx.restore();
}

/** A standalone SVG file of the code. The logo is embedded, not linked, so
 * the file still shows it after it has been emailed to a printer. */
export function qrArtToSvg(art: QrArt, logoDataUrl: string | null): string {
  const shapes = art.rects
    .map(
      (rect) =>
        `<rect x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.w)}" height="${fmt(rect.h)}"${
          rect.r === 0 ? '' : ` rx="${fmt(rect.r)}"`
        } fill="${rect.color}"/>`,
    )
    .join('');
  let logo = '';
  if (art.logo && logoDataUrl) {
    const { x, y, size } = art.logo;
    const c = size / 2;
    const inner = c * 0.86;
    logo =
      `<clipPath id="qr-logo"><circle cx="${fmt(x + c)}" cy="${fmt(y + c)}" r="${fmt(inner)}"/></clipPath>` +
      `<circle cx="${fmt(x + c)}" cy="${fmt(y + c)}" r="${fmt(c)}" fill="${art.background}"/>` +
      `<image href="${logoDataUrl}" x="${fmt(x + c - inner)}" y="${fmt(y + c - inner)}" width="${fmt(inner * 2)}" height="${fmt(
        inner * 2,
      )}" preserveAspectRatio="xMidYMid slice" clip-path="url(#qr-logo)"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(art.size)} ${String(art.size)}" width="1024" height="1024">` +
    `<rect width="100%" height="100%" fill="${art.background}"/>${shapes}${logo}</svg>`
  );
}

/** Like CSS `object-fit: cover`. */
export function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const { width: iw, height: ih } = sourceSize(image);
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function sourceSize(image: CanvasImageSource): { width: number; height: number } {
  if (image instanceof HTMLImageElement) return { width: image.naturalWidth, height: image.naturalHeight };
  if (image instanceof HTMLCanvasElement || image instanceof ImageBitmap) return { width: image.width, height: image.height };
  return { width: 0, height: 0 };
}

function fmt(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mixes `hex` towards `toward` by `amount` (0–1). */
export function mix(hex: string, toward: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  const out = a.map((channel, i) => Math.round(channel + ((b[i] ?? channel) - channel) * amount));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

import { drawCover, hexToRgb, type QrArt } from './qr-art';

/**
 * A one-page PDF, written by hand.
 *
 * The poster used to be a PDF built on the server with pdfkit, which reads
 * its font files from disk at run time — files a serverless bundle can leave
 * behind, so the button did nothing. A PDF that holds one picture, or a QR
 * code made of rectangles, is a few objects and a cross-reference table;
 * writing it here needs no library and no server.
 */

interface PdfImage {
  /** JPEG bytes: PDFs embed those as-is (DCTDecode), with no re-encoding. */
  jpeg: Uint8Array;
  width: number;
  height: number;
}

const encoder = new TextEncoder();

function buildPdf(pageWidth: number, pageHeight: number, content: string, image: PdfImage | null): Blob {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: () => void) => {
    offsets[id] = length;
    push(`${String(id)} 0 obj\n`);
    body();
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%âãÏÓ\n');
  object(1, () => {
    push('<< /Type /Catalog /Pages 2 0 R >>');
  });
  object(2, () => {
    push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  });
  object(3, () => {
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pageWidth)} ${num(pageHeight)}] /Contents 4 0 R /Resources << ${
        image ? '/XObject << /Im1 5 0 R >>' : ''
      } >> >>`,
    );
  });
  const stream = encoder.encode(content);
  object(4, () => {
    push(`<< /Length ${String(stream.length)} >>\nstream\n`);
    push(stream);
    push('\nendstream');
  });
  if (image) {
    object(5, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${String(image.width)} /Height ${String(image.height)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${String(image.jpeg.length)} >>\nstream\n`,
      );
      push(image.jpeg);
      push('\nendstream');
    });
  }

  const count = image ? 6 : 5;
  const xref = length;
  push(`xref\n0 ${String(count)}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id += 1) {
    push(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${String(count)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

/** A picture filling a page of the given size in millimetres. */
export async function pdfFromCanvas(canvas: HTMLCanvasElement, widthMm: number, heightMm: number): Promise<Blob> {
  const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.94);
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  const w = mm(widthMm);
  const h = mm(heightMm);
  return buildPdf(w, h, `q ${num(w)} 0 0 ${num(h)} 0 0 cm /Im1 Do Q`, { jpeg, width: canvas.width, height: canvas.height });
}

/**
 * The QR code as vector shapes on a square page, so it prints sharp at any
 * size. The logo, when there is one, is the only picture, drawn at 600 px.
 */
export async function pdfFromQrArt(art: QrArt, sizeMm: number, logo: CanvasImageSource | null): Promise<Blob> {
  const page = mm(sizeMm);
  const unit = page / art.size;
  // PDF puts the origin bottom-left; the art's is top-left.
  const flipY = (y: number, h: number) => page - (y + h) * unit;
  const ops: string[] = [`${rgb(art.background)} rg 0 0 ${num(page)} ${num(page)} re f`];

  let current = '';
  for (const rect of art.rects) {
    const colour = rgb(rect.color);
    if (colour !== current) {
      ops.push(`${colour} rg`);
      current = colour;
    }
    const x = rect.x * unit;
    const y = flipY(rect.y, rect.h);
    const w = rect.w * unit;
    const h = rect.h * unit;
    ops.push(rect.r === 0 ? `${num(x)} ${num(y)} ${num(w)} ${num(h)} re f` : `${roundRect(x, y, w, h, rect.r * unit)} f`);
  }

  let image: PdfImage | null = null;
  if (art.logo && logo) {
    const side = art.logo.size * unit;
    const x = art.logo.x * unit;
    const y = flipY(art.logo.y, art.logo.size);
    // The logo sits in the cleared block on a disc of the background colour;
    // baked into one square JPEG so the PDF needs no transparency or clipping.
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = art.background;
      ctx.fillRect(0, 0, 600, 600);
      ctx.save();
      ctx.beginPath();
      ctx.arc(300, 300, 300 * 0.86, 0, Math.PI * 2);
      ctx.clip();
      drawCover(ctx, logo, 300 - 258, 300 - 258, 516, 516);
      ctx.restore();
      const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      image = { jpeg: new Uint8Array(await jpegBlob.arrayBuffer()), width: 600, height: 600 };
      ops.push(`q ${num(side)} 0 0 ${num(side)} ${num(x)} ${num(y)} cm /Im1 Do Q`);
    }
  }

  return buildPdf(page, page, ops.join('\n'), image);
}

/** A rounded rectangle as a PDF path (Bézier corners). */
function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const k = r * 0.5523;
  return [
    `${num(x + r)} ${num(y)} m`,
    `${num(x + w - r)} ${num(y)} l`,
    `${num(x + w - r + k)} ${num(y)} ${num(x + w)} ${num(y + r - k)} ${num(x + w)} ${num(y + r)} c`,
    `${num(x + w)} ${num(y + h - r)} l`,
    `${num(x + w)} ${num(y + h - r + k)} ${num(x + w - r + k)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)} c`,
    `${num(x + r)} ${num(y + h)} l`,
    `${num(x + r - k)} ${num(y + h)} ${num(x)} ${num(y + h - r + k)} ${num(x)} ${num(y + h - r)} c`,
    `${num(x)} ${num(y + r)} l`,
    `${num(x)} ${num(y + r - k)} ${num(x + r - k)} ${num(y)} ${num(x + r)} ${num(y)} c h`,
  ].join(' ');
}

function rgb(hex: string): string {
  return hexToRgb(hex)
    .map((channel) => num(channel / 255))
    .join(' ');
}

function mm(value: number): number {
  return (value * 72) / 25.4;
}

function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The image could not be encoded.'));
      },
      type,
      quality,
    );
  });
}

import jsQR from 'jsqr';

/**
 * What an uploaded payment QR image actually contains.
 *
 * Built after a live page had `8758018050@upi` typed in as its UPI ID, while
 * its own uploaded PhonePe QR paid `8758408987@ybl`. Scanning worked; tapping
 * Pay failed with "Receiver's UPI ID is not available" — and nothing in the
 * admin could have told the owner the two disagreed. The QR is the ground
 * truth (the UPI app printed it), so we read it and compare.
 */
export type QrReading =
  | { kind: 'upi'; upiId: string; payeeName: string | null; accountType: 'personal' | 'merchant' }
  | { kind: 'not-upi' }
  | { kind: 'no-qr' }
  | { kind: 'unreadable' };

/** Case and stray whitespace don't make a different UPI ID. */
export function normaliseUpiId(value: string): string {
  return value.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
}

function parseUpiPayload(text: string): QrReading {
  const trimmed = text.trim();
  if (!/^upi:\/\/pay\?/i.test(trimmed)) {
    return { kind: 'not-upi' };
  }
  // Parse the query by hand: payee names in real QRs are not always validly
  // percent-encoded, and URLSearchParams would also read `+` as a space.
  const query = trimmed.slice(trimmed.indexOf('?') + 1);
  const fields = new Map<string, string>();
  for (const part of query.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).toLowerCase();
    const raw = part.slice(eq + 1);
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // Keep the raw value.
    }
    fields.set(key, value);
  }
  const pa = fields.get('pa');
  if (!pa || !/^[\w.-]+@[\w.-]+$/.test(normaliseUpiId(pa))) {
    return { kind: 'not-upi' };
  }
  // `mc` is the merchant category code. A business QR carries a real one
  // (5411 grocery, 5812 restaurant…); a personal QR has `0000` or none.
  // UPI apps refuse website-started payments to personal IDs — the customer
  // sees "exceeded the bank limit" or "declined for security reasons" — so
  // the landing page needs to know which kind this is.
  const mc = fields.get('mc')?.trim() ?? '';
  const accountType = /^\d{4}$/.test(mc) && mc !== '0000' ? 'merchant' : 'personal';
  return { kind: 'upi', upiId: normaliseUpiId(pa), payeeName: fields.get('pn')?.trim() || null, accountType };
}

/** Tries a few sizes: posters carry a small QR on a big canvas, phone
 * screenshots carry a huge one, and jsQR prefers neither extreme. */
function decodeBitmap(bitmap: ImageBitmap): string | null {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  const longSide = Math.max(bitmap.width, bitmap.height);
  for (const target of [1000, 1600, 600]) {
    const scale = Math.min(1, target / longSide);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
    if (result?.data) return result.data;
    if (scale === 1) break; // Larger targets would only repeat this size.
  }
  return null;
}

/** Reads an image the owner just picked, or one already saved (by URL). */
export async function readUpiQr(source: Blob | string): Promise<QrReading> {
  try {
    const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
    const bitmap = await createImageBitmap(blob);
    try {
      const text = decodeBitmap(bitmap);
      return text ? parseUpiPayload(text) : { kind: 'no-qr' };
    } finally {
      bitmap.close();
    }
  } catch {
    return { kind: 'unreadable' };
  }
}

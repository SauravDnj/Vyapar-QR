import { PlatformLogo, type BrandName } from '@vyaparqr/ui';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { BrandBadge } from './posters';

const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Cormorant:wght@500;600;700&family=Montserrat:wght@500;600;700&display=swap';

/**
 * The page's two typefaces, loaded before anything is drawn. A canvas draws
 * with whatever is loaded at that moment, so without this the first poster
 * came out in Georgia and Arial and the next one, a second later, did not.
 */
export async function loadDesignFonts(): Promise<void> {
  if (!document.querySelector(`link[href="${FONT_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_CSS;
    document.head.appendChild(link);
    await new Promise<void>((resolve) => {
      link.onload = () => {
        resolve();
      };
      link.onerror = () => {
        resolve();
      };
    });
  }
  await Promise.allSettled(
    ['600 60px "Cormorant"', '700 60px "Cormorant"', '500 20px "Montserrat"', '600 20px "Montserrat"', '700 20px "Montserrat"'].map(
      (font) => document.fonts.load(font),
    ),
  );
}

export interface LoadedImage {
  image: HTMLImageElement;
  /** For embedding in the SVG download. */
  dataUrl: string;
}

/**
 * Loads an image through fetch rather than `<img src>`, so the canvas it is
 * drawn on stays exportable — a cross-origin image drawn directly would
 * "taint" the canvas and every download from it would throw.
 *
 * A logo is a few hundred kilobytes and a shop's connection can be slow, so
 * a slow answer is waited out (30s). Giving up quietly is what made posters
 * come out with initials instead of the logo, so it tries three ways before
 * it does:
 *
 * 1. a normal fetch, from the browser's cache if it has the file;
 * 2. a fresh fetch that skips every cache. Uploads are served as immutable
 *    for a year, so a copy cached before the API sent CORS headers (or cached
 *    by the landing page's plain `<img>`) would otherwise fail this page's
 *    CORS check for a year — the query string makes it a new URL to the CDN
 *    as well as to the browser;
 * 3. an `<img crossorigin>` load, copied onto a canvas.
 */
export async function loadImage(url: string, timeoutMs = 30_000): Promise<LoadedImage | null> {
  const fresh = `${url}${url.includes('?') ? '&' : '?'}print=${String(Date.now())}`;
  const attempts: [string, RequestCache][] = [
    [url, 'force-cache'],
    [fresh, 'reload'],
  ];
  for (const [target, cache] of attempts) {
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      abort.abort();
    }, timeoutMs);
    try {
      const response = await fetch(target, { signal: abort.signal, cache, mode: 'cors', credentials: 'omit' });
      // A 404 will not fix itself on a retry.
      if (response.status === 404) return null;
      if (!response.ok) continue;
      const dataUrl = await blobToDataUrl(await response.blob());
      return await settle(dataUrl);
    } catch {
      // Falls through to the next way.
    } finally {
      window.clearTimeout(timer);
    }
  }
  try {
    const image = await imageFrom(fresh, true);
    return await settle(rasterise(image).toDataURL('image/png'));
  } catch {
    return null;
  }
}

/**
 * A decoded image with a real size. An SVG saved without width and height
 * decodes with a natural size of 0 × 0, which every drawing helper treats as
 * "nothing to draw" — the logo disc came out blank. Those are drawn onto a
 * square canvas first so they have one.
 */
async function settle(dataUrl: string): Promise<LoadedImage> {
  const image = await imageFrom(dataUrl);
  if (image.naturalWidth && image.naturalHeight) return { image, dataUrl };
  const sized = rasterise(image).toDataURL('image/png');
  return { image: await imageFrom(sized), dataUrl: sized };
}

function rasterise(image: HTMLImageElement): HTMLCanvasElement {
  const width = image.naturalWidth || 1024;
  const height = image.naturalHeight || 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
  return canvas;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result));
    };
    reader.onerror = () => {
      reject(new Error('read failed'));
    };
    reader.readAsDataURL(blob);
  });
}

/** A logo picked from the device: no network, so nothing to go wrong. */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  return settle(await blobToDataUrl(file));
}

function imageFrom(src: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = 'anonymous';
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('image failed to load'));
    };
    image.src = src;
  });
}

const WIDE: Partial<Record<BrandName, number>> = { gpay: 2, paytm: 2, upi: 2 };

/** The same brand marks the landing page shows, turned into images. */
export async function loadBrandBadges(brands: BrandName[]): Promise<BrandBadge[]> {
  const badges: (BrandBadge | null)[] = await Promise.all(
    brands.map(async (brand) => {
      const aspect = WIDE[brand] ?? 1;
      const markup = renderToStaticMarkup(createElement(PlatformLogo, { brand })).replace(
        '<svg',
        `<svg width="${String(96 * aspect)}" height="96"`,
      );
      try {
        const image = await imageFrom(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
        return { image, aspect };
      } catch {
        return null;
      }
    }),
  );
  return badges.filter((badge): badge is BrandBadge => badge !== null);
}

/**
 * Saves a file. The link is attached to the page and its URL kept alive for a
 * minute: revoking it straight after `click()`, as before, can cancel the
 * download before the browser has read it.
 */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}

/** "Table 5 – Downtown" → "table-5-downtown". */
export function fileSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'qr'
  );
}

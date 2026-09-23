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
 * a slow answer is waited out (30s) and one failure is retried before giving
 * up. Giving up quietly is what made posters come out with initials instead
 * of the logo, so the caller is told which happened.
 */
export async function loadImage(url: string, timeoutMs = 30_000): Promise<LoadedImage | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      abort.abort();
    }, timeoutMs);
    try {
      const response = await fetch(url, { signal: abort.signal, cache: 'force-cache' });
      if (!response.ok) {
        // A 404 or 403 will not fix itself on a retry.
        if (response.status >= 400 && response.status < 500) return null;
        continue;
      }
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(String(reader.result));
        };
        reader.onerror = () => {
          reject(new Error('read failed'));
        };
        reader.readAsDataURL(blob);
      });
      return { image: await imageFrom(dataUrl), dataUrl };
    } catch {
      // Falls through to the retry.
    } finally {
      window.clearTimeout(timer);
    }
  }
  return null;
}

function imageFrom(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
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

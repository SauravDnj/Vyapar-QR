import type { CSSProperties } from 'react';

/** Section content values are always plain strings (never undefined), so an
 * empty string means "not filled in yet" and should fall back — `??` alone
 * wouldn't catch that, and the lint config forbids `||` for this. */
export function orDefault(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  return value;
}

/** A menu/brochure upload can be either an image or a PDF — this is the
 * single place that decides which, from the URL's extension (the upload
 * endpoint preserves the original file extension, see StorageService). */
export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().split('?')[0]?.endsWith('.pdf') ?? false;
}

/** Builds the `style` object for a theme's accent-color CSS custom property.
 * Themes reference the color via `var(--theme-accent, <their own default>)`
 * in Tailwind arbitrary-value classes (e.g. `bg-[var(--theme-accent,#0e7c66)]`)
 * so a client's chosen color overrides it, and the theme's own default still
 * applies when no color has been chosen. */
export function accentColorStyle(accentColor: string | null | undefined): CSSProperties {
  return accentColor ? ({ '--theme-accent': accentColor } as CSSProperties) : {};
}

import type { ThemeDensity, ThemeFont, ThemeRadius } from '@qrhub/types';

/**
 * Font stacks for the catalog's type pairings.
 *
 * System stacks rather than webfonts: a landing page is opened from a QR scan,
 * usually on mobile data, and a hundred themes pulling their own Google Fonts
 * would mean a render-blocking download on the one page where time-to-content
 * decides whether the visitor stays.
 */
export const FONT_STACKS: Record<ThemeFont, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  grotesk: '"Helvetica Neue", Helvetica, Arial, ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  slab: '"Rockwell", "Roboto Slab", ui-serif, Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  rounded: 'ui-rounded, "SF Pro Rounded", "Segoe UI Variable", system-ui, sans-serif',
  display: '"Trebuchet MS", "Gill Sans", ui-sans-serif, system-ui, sans-serif',
  humanist: '"Segoe UI", Tahoma, Verdana, ui-sans-serif, system-ui, sans-serif',
};

export const RADIUS: Record<ThemeRadius, string> = {
  none: '0px',
  sm: '4px',
  md: '10px',
  lg: '16px',
  xl: '24px',
  full: '32px',
};

/** Vertical rhythm. `gap` separates sections; `pad` is the inside of a card. */
export const SPACING: Record<ThemeDensity, { gap: string; pad: string }> = {
  compact: { gap: '16px', pad: '16px' },
  normal: { gap: '24px', pad: '20px' },
  roomy: { gap: '36px', pad: '28px' },
};

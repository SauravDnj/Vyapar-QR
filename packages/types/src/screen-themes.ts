/**
 * The theme catalog.
 *
 * Every theme is a single-screen, mobile-first page: the whole business card
 * fits one phone viewport with no page scroll, and everything that doesn't
 * fit (menu, gallery, offers, the payment flow) opens in a bottom sheet.
 *
 * The list lives here, not in `@vyaparqr/ui`, because both sides consume it:
 * the UI renders by name and the API seeds the theme table from it, so the
 * picker and the renderer cannot drift apart.
 */
export interface ScreenThemeInfo {
  /** Stored in the database and used to pick the renderer. */
  name: string;
  /** Groups themes in the picker. */
  category: string;
  /** One line on who the theme suits. */
  description: string;
}

export const SCREEN_THEMES: readonly ScreenThemeInfo[] = [
  {
    name: 'Ivory',
    category: 'Classic',
    description: 'A premium printed business card: calm, trustworthy, fits any business.',
  },
  {
    name: 'Noir',
    category: 'Luxury',
    description: 'Black and gold with a slow gold ring and shimmer — salons, jewellers, fine dining.',
  },
  {
    name: 'Aurora',
    category: 'Modern',
    description: 'Moving colour behind frosted glass — cafes, gyms, studios and creators.',
  },
];

/** Where any page whose theme no longer exists lands. */
export const DEFAULT_THEME_NAME = 'Ivory';

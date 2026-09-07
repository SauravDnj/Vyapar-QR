/**
 * Token-driven themes.
 *
 * The first 13 themes were hand-written React components of ~200 lines each,
 * all rendering the same sections in the same order and differing only in
 * presentation. Reaching a catalog of a hundred that way would mean 20,000
 * lines of near-duplicate JSX, and every new section would have to be added to
 * every file.
 *
 * A theme is therefore *data*: a palette, a type pairing, and a set of shape
 * and layout choices. One renderer reads those tokens, so a new theme is a
 * dozen lines in the catalog and every theme gains new sections for free.
 */

/** Corner rounding, applied consistently to cards, buttons and images. */
export type ThemeRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

/** How content blocks sit on the page background. */
export type ThemeSurface =
  /** No container — content sits directly on the background. */
  | 'flat'
  /** Solid card with a soft shadow. */
  | 'card'
  /** Card defined by a border rather than a shadow. */
  | 'outlined'
  /** Card with a pronounced shadow, lifted off the page. */
  | 'elevated'
  /** Translucent card over a coloured or image background. */
  | 'glass';

/** The shape of the top of the page — the strongest identity signal. */
export type ThemeHero =
  /** Logo, name and tagline stacked and centred. */
  | 'centered'
  /** Full-bleed colour band behind the hero. */
  | 'banner'
  /** Logo beside the text rather than above it. */
  | 'split'
  /** Type only, generous space, no ornament. */
  | 'minimal'
  /** Colour gradient wash behind the hero. */
  | 'gradient'
  /** Background photo with a legibility scrim. */
  | 'overlay';

/** Button treatment, applied to payment, social and form actions. */
export type ThemeButton = 'solid' | 'outline' | 'pill' | 'sharp' | 'soft';

/** Vertical rhythm — how much air sits between sections. */
export type ThemeDensity = 'compact' | 'normal' | 'roomy';

/** How section headings are presented. */
export type ThemeHeading =
  | 'plain'
  | 'uppercase'
  | 'underline'
  | 'centered'
  | 'eyebrow';

/** A curated type pairing. Values map to font stacks in the renderer. */
export type ThemeFont =
  | 'sans'
  | 'grotesk'
  | 'serif'
  | 'slab'
  | 'mono'
  | 'rounded'
  | 'display'
  | 'humanist';

export interface ThemePalette {
  /** Page background. */
  bg: string;
  /** Card / container background. */
  surface: string;
  /** Primary text. Must reach 4.5:1 against both `bg` and `surface`. */
  text: string;
  /** Secondary text. Must reach 4.5:1 — it is body copy, not decoration. */
  muted: string;
  /** Brand colour: buttons, links, active states. */
  accent: string;
  /** Text placed on `accent`. Must reach 4.5:1 against it. */
  accentText: string;
  /** Hairlines and card borders. */
  border: string;
}

export interface ThemeTokens {
  /** Stable identifier, also the catalog key. */
  id: string;
  /** Shown in the theme picker. */
  name: string;
  /** Groups themes in the picker, e.g. "Restaurant", "Salon & Spa". */
  category: string;
  /** One line on why a business would pick this one. */
  description: string;
  palette: ThemePalette;
  heading: ThemeFont;
  body: ThemeFont;
  radius: ThemeRadius;
  surface: ThemeSurface;
  hero: ThemeHero;
  button: ThemeButton;
  density: ThemeDensity;
  headingStyle: ThemeHeading;
  /** Marks the palette as dark, so the renderer can pick matching scrims. */
  dark?: boolean;
}

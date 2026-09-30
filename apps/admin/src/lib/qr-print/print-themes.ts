import { contrast, mix } from './qr-art';

/**
 * The colour themes a printed sheet can wear.
 *
 * A theme is only three choices — the colour of the band, the metallic trim
 * that edges it, and the paper — and everything else on the sheet is worked
 * out from those three, so a custom pick from the colour picker comes out as
 * finished as one of the presets. The derived colours are checked against
 * the paper they sit on: small text keeps 4.5:1, and the code's corners keep
 * enough contrast for a camera to find them, whatever the three picks are.
 */

export interface PrintColours {
  /** The band behind the business's name; also the code's corners. */
  primary: string;
  /** The trim: the curved rules, the ring round the logo, the eyebrow lines. */
  trim: string;
  /** The paper. */
  paper: string;
}

export interface PrintTheme {
  id: string;
  name: string;
  /** Who it suits, shown under the name. */
  mood: string;
  colours: PrintColours;
}

export const PRINT_THEMES: PrintTheme[] = [
  {
    id: 'royal-maroon',
    name: 'Royal Maroon',
    mood: 'Jewellers, sarees, weddings',
    colours: { primary: '#7a1020', trim: '#c9a24a', paper: '#fbf6ec' },
  },
  {
    id: 'meta-blue',
    name: 'Meta Blue',
    mood: 'Clean and modern, any shop',
    colours: { primary: '#0866ff', trim: '#8fc0ff', paper: '#ffffff' },
  },
  {
    id: 'emerald-gold',
    name: 'Emerald Gold',
    mood: 'Pharmacy, organic, grocery',
    colours: { primary: '#0b5d3b', trim: '#c9a24a', paper: '#f6f8f1' },
  },
  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    mood: 'Salons, electronics, premium',
    colours: { primary: '#14213d', trim: '#d4af37', paper: '#f8f6f0' },
  },
  {
    id: 'saffron',
    name: 'Saffron',
    mood: 'Restaurants, sweets, cafés',
    colours: { primary: '#b8420f', trim: '#e0a526', paper: '#fff8ee' },
  },
];

export const DEFAULT_PRINT_THEME = PRINT_THEMES[0]!;

/** Every colour a sheet draws with, derived from the three picks. */
export interface Palette {
  primary: string;
  /** The band's lighter top stop and its darker bottom stop. */
  bandTop: string;
  bandBottom: string;
  /** Text and marks that sit on the band. */
  onBand: string;
  trim: string;
  /** A lighter trim for the highlight in gradients. */
  trimLight: string;
  paper: string;
  /** The primary darkened (or lightened) until small text reads on the paper. */
  ink: string;
  /** Body text on the paper. */
  text: string;
  muted: string;
  /** The footer strip and tag fills. */
  tint: string;
  /** Hairlines and card borders. */
  edge: string;
  /** The code's corner marks and finder squares: they must be findable. */
  mark: string;
}

export function paletteFrom({ primary, trim, paper }: PrintColours): Palette {
  const dark = contrast(paper, '#000000') > contrast(paper, '#ffffff');
  const text = dark ? '#1c1917' : '#f5f5f4';
  const ink = readable(primary, paper, 4.5);
  const onBand = contrast(primary, '#ffffff') >= 3 ? '#ffffff' : '#1c1917';
  return {
    primary,
    bandTop: mix(primary, '#ffffff', 0.12),
    bandBottom: mix(primary, '#000000', 0.28),
    onBand,
    trim,
    trimLight: mix(trim, '#ffffff', 0.45),
    paper,
    ink,
    text,
    muted: mix(text, paper, 0.32),
    tint: mix(trim, paper, 0.84),
    edge: mix(trim, paper, 0.45),
    mark: readable(primary, '#ffffff', 3.2),
  };
}

/** Steps `colour` towards black or white until it clears `ratio` on `ground`. */
function readable(colour: string, ground: string, ratio: number): string {
  if (contrast(colour, ground) >= ratio) return colour;
  const toward = contrast(ground, '#000000') > contrast(ground, '#ffffff') ? '#000000' : '#ffffff';
  for (let amount = 0.1; amount < 1; amount += 0.1) {
    const next = mix(colour, toward, amount);
    if (contrast(next, ground) >= ratio) return next;
  }
  return toward;
}

export function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

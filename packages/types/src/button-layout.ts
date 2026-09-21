/**
 * How the landing page lays out its action buttons (Call, WhatsApp,
 * Directions, Review, social profiles, Enquire).
 *
 * The owner can leave both settings on Auto or pick them. It lives here, not
 * in the theme, because the admin shows the same result the page will draw
 * ("Auto → 3 × 2 for your 5 buttons"), and the two must not disagree.
 */

export const BUTTON_COLUMN_CHOICES = ['auto', '2', '3', '4'] as const;
export type ButtonColumns = (typeof BUTTON_COLUMN_CHOICES)[number];

export const BUTTON_SIZE_CHOICES = ['auto', 'small', 'medium', 'large'] as const;
export type ButtonSize = (typeof BUTTON_SIZE_CHOICES)[number];

/** The page never scrolls, so the grid never goes past this many rows. */
export const MAX_BUTTON_ROWS = 3;

export interface ButtonGrid {
  cols: number;
  rows: number;
  /** Buttons on the last row when it isn't full; the page centres them. */
  lastRowCount: number;
  /** Whether the chosen columns had to be widened to stay within MAX_BUTTON_ROWS. */
  widened: boolean;
}

/**
 * Auto: the fewest columns that keep the grid even and within three rows, so
 * buttons stay as large as the count allows.
 *
 *   1–3 → one row    4 → 2 × 2    5–6 → 3 × 2    7–8 → 4 × 2    9 → 3 × 3
 *
 * Four buttons used to be one row of four small tiles; 2 × 2 gives each one
 * twice the width. Seven and eight take four columns because three would need
 * a third row the screen doesn't have room for next to the logo and Pay bar.
 */
export function autoColumns(count: number): number {
  if (count <= 3) return Math.max(count, 1);
  if (count === 4) return 2;
  if (count <= 6) return 3;
  if (count <= 8) return 4;
  return 3;
}

/**
 * The grid for `count` buttons. A manual choice is used as given unless it
 * would need more than MAX_BUTTON_ROWS rows — say two columns chosen for five
 * buttons, and then three social links added — in which case columns are
 * added until it fits, rather than pushing buttons off the screen.
 */
export function buttonGrid(count: number, columns: ButtonColumns = 'auto'): ButtonGrid {
  const wanted = columns === 'auto' ? autoColumns(count) : Number(columns);
  const fits = Math.max(wanted, Math.ceil(count / MAX_BUTTON_ROWS));
  const cols = Math.max(1, Math.min(fits, Math.max(count, 1)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const remainder = count % cols;
  return { cols, rows, lastRowCount: remainder, widened: cols > wanted };
}

export function parseButtonColumns(value: string | undefined): ButtonColumns {
  return (BUTTON_COLUMN_CHOICES as readonly string[]).includes(value ?? '') ? (value as ButtonColumns) : 'auto';
}

export function parseButtonSize(value: string | undefined): ButtonSize {
  return (BUTTON_SIZE_CHOICES as readonly string[]).includes(value ?? '') ? (value as ButtonSize) : 'auto';
}

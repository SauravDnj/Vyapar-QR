import { loadImage, type LoadedImage } from './assets';

/**
 * The platform's own two marks along the top of every printed sheet: Waloop
 * on the left, the Meta partner badge on the right.
 *
 * They are files under `public/brand/`, not artwork in code, so replacing
 * them is dropping in a new PNG. Until a file is there the sheet draws a
 * labelled placeholder of the same size in the same place — the layout is
 * final either way, and nothing shifts when the real image arrives.
 */
export interface PlatformMark {
  /** Where the file is expected. Missing is fine — a placeholder is drawn. */
  src: string;
  /** Shown in the placeholder, and read out to anyone who can't see it. */
  label: string;
  /** Second line of the placeholder. */
  sub?: string;
  /** width ÷ height of the slot the mark is drawn into. */
  aspect: number;
}

export const PLATFORM_MARKS: { left: PlatformMark; right: PlatformMark } = {
  // Aspects are the real artwork's, so each mark keeps its own proportions
  // instead of being stretched into a shared box.
  left: { src: '/brand/waloop.png', label: 'WALOOP', aspect: 542 / 348 },
  right: { src: '/brand/meta-partner.png', label: 'META', sub: 'Business Partner', aspect: 540 / 219 },
};

export interface LoadedPlatformMarks {
  left: LoadedImage | null;
  right: LoadedImage | null;
}

/** Loads whichever marks exist. A missing file is not an error. */
export async function loadPlatformMarks(): Promise<LoadedPlatformMarks> {
  const [left, right] = await Promise.all([
    loadImage(PLATFORM_MARKS.left.src, 8_000),
    loadImage(PLATFORM_MARKS.right.src, 8_000),
  ]);
  return { left, right };
}

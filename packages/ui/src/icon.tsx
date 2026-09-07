import type { CSSProperties } from 'react';

/**
 * The icon set used by themes.
 *
 * Inline SVG paths rather than an icon package: themes need a handful of
 * glyphs, and pulling a full library into a page opened from a QR scan on
 * mobile data is a poor trade. The previous themes used the first letter of a
 * label in a circle ("A" for Address), which reads as unfinished and carries
 * no meaning to anyone who doesn't already know what it stands for.
 *
 * Every icon is `aria-hidden` — each one sits beside a real text label or an
 * `sr-only` term, so announcing it again would only add noise.
 */
const PATHS = {
  'map-pin': 'M12 21s-7-5.686-7-11a7 7 0 1 1 14 0c0 5.314-7 11-7 11Z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2',
  phone: 'M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z',
  mail: 'M4 6h16v12H4z M4 7l8 6 8-6',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z',
  share: 'M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M8.2 10.8l7.6-4.1 M8.2 13.2l7.6 4.1',
  check: 'M4.5 12.5l5 5 10-11',
  external: 'M14 4h6v6 M20 4l-8.5 8.5 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className,
  style,
}: {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].split(' M').map((segment, index) => (
        <path key={index} d={index === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}

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
  navigation: 'M3.5 10.5 20.5 3.5l-7 17-2.2-7.8-7.8-2.2Z',
  grid: 'M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z',
  rupee: 'M6.5 4h11 M6.5 8.5h11 M9.5 4c3.4 0 5.4 1.8 5.4 4.5S12.9 13 9.5 13H7.5l7 7',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5.5 M12 7.6v.1',
  image: 'M4 5h16v14H4z M4 15.5l4.5-4.5 4.5 4.5 2.5-2.5 4.5 4.5 M15.5 9h.01',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Z M13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13Z',
  tag: 'M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7-8.3-8.3Z M8 8h.01',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3.5v4 M16 3.5v4',
  message: 'M4 5h16v11H9.5L4 20Z M8 9.5h8 M8 12.5h5',
  bag: 'M5.5 8h13l-1 12h-11l-1-12Z M9 8V6.5a3 3 0 0 1 6 0V8',
  gift: 'M4 11h16v9H4z M3 7h18v4H3z M12 7v13 M12 7C10.5 3.5 6.5 4 7.5 7 M12 7c1.5-3.5 5.5-3 4.5 0',
  quote: 'M5 18c2-1 3.5-3 3.5-6.5H5V6h5.5v5.5c0 4.5-2.5 7.5-5.5 8.5Z M13.5 18c2-1 3.5-3 3.5-6.5h-3.5V6H19v5.5c0 4.5-2.5 7.5-5.5 8.5Z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z',
  'user-plus': 'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M3 20.5a7 7 0 0 1 13.5-2.5 M19 8v6 M16 11h6',
  close: 'M6 6l12 12 M18 6 6 18',
  'chevron-right': 'M9.5 6l6 6-6 6',
  'arrow-up-right': 'M7 17 17 7 M8.5 7H17v8.5',
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

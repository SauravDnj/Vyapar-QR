/**
 * Generates `src/theme-catalog.generated.ts`.
 *
 * The catalog lives in `@qrhub/types` rather than `@qrhub/ui` because both
 * consume it: the UI renders from it, and the API seeds the theme table from
 * it. Keeping one copy is what stops the database and the renderer drifting
 * apart over a hundred entries.
 *
 * A hundred themes means ~700 individual colours. Picking those by eye and
 * hoping they are legible is how you ship a theme whose body text fails
 * contrast on a phone in sunlight, so the palettes are defined here as a small
 * set of verified families and every colour pair is checked against WCAG AA
 * (4.5:1) at generation time. If a pair fails, this script refuses to emit.
 *
 *   node scripts/build-theme-catalog.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── contrast ──────────────────────────────────────────────────────────────

function luminance(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(full.slice(0, 2), 16));
  const g = channel(parseInt(full.slice(2, 4), 16));
  const b = channel(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ── palette families ──────────────────────────────────────────────────────
// Each family is one identity. `light` and `dark` are separate palettes so a
// theme can commit to either without recomputing anything at runtime.

/** Neutrals reused across light palettes, all verified against #ffffff. */
const L = { text: '#111827', muted: '#4b5563', border: '#e5e7eb' };
/** Neutrals for dark palettes, verified against the dark surfaces below. */
const D = { text: '#f3f4f6', muted: '#b6bdc8', border: '#333a47' };

const light = (bg, surface, accent, accentText = '#ffffff') => ({
  bg, surface, accent, accentText, ...L,
});
const dark = (bg, surface, accent, accentText = '#08111f') => ({
  bg, surface, accent, accentText, ...D,
});

const FAMILIES = {
  espresso: light('#faf7f2', '#ffffff', '#7c4a24'),
  sage: light('#f4f7f3', '#ffffff', '#3f6b46'),
  ocean: light('#f2f7fb', '#ffffff', '#125e91'),
  ink: light('#f6f6f7', '#ffffff', '#1f2937'),
  plum: light('#f9f4fa', '#ffffff', '#713078'),
  sunset: light('#fff6f1', '#ffffff', '#b04412'),
  forest: light('#f2f6f3', '#ffffff', '#1f5b3a'),
  cobalt: light('#f3f5fd', '#ffffff', '#2540a8'),
  rose: light('#fdf4f6', '#ffffff', '#a4324f'),
  amber: light('#fff9ee', '#ffffff', '#8a5a06'),
  teal: light('#f0f8f8', '#ffffff', '#0e6b6b'),
  slate: light('#f5f6f8', '#ffffff', '#3d4a5c'),
  berry: light('#fbf3f7', '#ffffff', '#8f2d5a'),
  moss: light('#f5f7f0', '#ffffff', '#4a6118'),
  clay: light('#fbf5f2', '#ffffff', '#93502f'),
  denim: light('#f3f6fa', '#ffffff', '#31548a'),
  mint: light('#f0faf5', '#ffffff', '#0f7048'),
  wine: light('#faf3f4', '#ffffff', '#8b2434'),
  steel: light('#f4f6f7', '#ffffff', '#41586b'),
  saffron: light('#fff8ed', '#ffffff', '#9a5b00'),
  lilac: light('#f7f5fc', '#ffffff', '#5b46a8'),
  copper: light('#fdf6f0', '#ffffff', '#9c5522'),
  midnight: dark('#0d1117', '#161c26', '#6ea8fe'),
  charcoal: dark('#131313', '#1d1d1d', '#e5b567'),
  onyx: dark('#0b0f14', '#141a22', '#5ed3c4'),
  noir: dark('#101014', '#191921', '#d98cb3'),
  graphite: dark('#14171c', '#1e232b', '#8fd18a'),
  obsidian: dark('#0c1013', '#151b20', '#f0a868'),
};

// ── style presets per business category ───────────────────────────────────
// Shape/type choices that suit a category, cycled across its themes so no two
// look alike.

const PRESETS = {
  Restaurant: [
    { heading: 'serif', body: 'sans', radius: 'lg', surface: 'card', hero: 'centered', button: 'pill', density: 'normal', headingStyle: 'centered' },
    { heading: 'display', body: 'humanist', radius: 'md', surface: 'elevated', hero: 'banner', button: 'solid', density: 'normal', headingStyle: 'plain' },
    { heading: 'slab', body: 'sans', radius: 'sm', surface: 'outlined', hero: 'split', button: 'sharp', density: 'compact', headingStyle: 'uppercase' },
    { heading: 'serif', body: 'serif', radius: 'xl', surface: 'flat', hero: 'minimal', button: 'soft', density: 'roomy', headingStyle: 'underline' },
  ],
  'Salon & Spa': [
    { heading: 'serif', body: 'sans', radius: 'full', surface: 'flat', hero: 'minimal', button: 'pill', density: 'roomy', headingStyle: 'centered' },
    { heading: 'rounded', body: 'rounded', radius: 'xl', surface: 'card', hero: 'gradient', button: 'pill', density: 'roomy', headingStyle: 'eyebrow' },
    { heading: 'serif', body: 'humanist', radius: 'lg', surface: 'glass', hero: 'overlay', button: 'soft', density: 'normal', headingStyle: 'underline' },
    { heading: 'display', body: 'sans', radius: 'md', surface: 'outlined', hero: 'centered', button: 'outline', density: 'roomy', headingStyle: 'uppercase' },
  ],
  Retail: [
    { heading: 'grotesk', body: 'sans', radius: 'sm', surface: 'outlined', hero: 'split', button: 'sharp', density: 'compact', headingStyle: 'uppercase' },
    { heading: 'display', body: 'sans', radius: 'md', surface: 'card', hero: 'banner', button: 'solid', density: 'normal', headingStyle: 'plain' },
    { heading: 'sans', body: 'sans', radius: 'lg', surface: 'elevated', hero: 'centered', button: 'pill', density: 'normal', headingStyle: 'centered' },
    { heading: 'mono', body: 'sans', radius: 'none', surface: 'flat', hero: 'minimal', button: 'sharp', density: 'compact', headingStyle: 'eyebrow' },
  ],
  Professional: [
    { heading: 'serif', body: 'sans', radius: 'sm', surface: 'outlined', hero: 'split', button: 'sharp', density: 'normal', headingStyle: 'plain' },
    { heading: 'grotesk', body: 'humanist', radius: 'md', surface: 'card', hero: 'minimal', button: 'solid', density: 'normal', headingStyle: 'underline' },
    { heading: 'slab', body: 'sans', radius: 'none', surface: 'flat', hero: 'banner', button: 'outline', density: 'compact', headingStyle: 'uppercase' },
    { heading: 'sans', body: 'sans', radius: 'lg', surface: 'elevated', hero: 'centered', button: 'soft', density: 'roomy', headingStyle: 'centered' },
  ],
  'Health & Fitness': [
    { heading: 'grotesk', body: 'sans', radius: 'full', surface: 'card', hero: 'gradient', button: 'pill', density: 'normal', headingStyle: 'uppercase' },
    { heading: 'display', body: 'rounded', radius: 'xl', surface: 'elevated', hero: 'banner', button: 'solid', density: 'normal', headingStyle: 'plain' },
    { heading: 'sans', body: 'humanist', radius: 'md', surface: 'outlined', hero: 'split', button: 'outline', density: 'compact', headingStyle: 'eyebrow' },
    { heading: 'slab', body: 'sans', radius: 'sm', surface: 'flat', hero: 'overlay', button: 'sharp', density: 'normal', headingStyle: 'centered' },
  ],
  'Home Services': [
    { heading: 'slab', body: 'sans', radius: 'sm', surface: 'outlined', hero: 'banner', button: 'sharp', density: 'compact', headingStyle: 'uppercase' },
    { heading: 'grotesk', body: 'sans', radius: 'md', surface: 'card', hero: 'split', button: 'solid', density: 'normal', headingStyle: 'plain' },
    { heading: 'display', body: 'humanist', radius: 'none', surface: 'flat', hero: 'centered', button: 'outline', density: 'normal', headingStyle: 'underline' },
  ],
  'Real Estate': [
    { heading: 'serif', body: 'sans', radius: 'sm', surface: 'outlined', hero: 'overlay', button: 'sharp', density: 'normal', headingStyle: 'uppercase' },
    { heading: 'sans', body: 'sans', radius: 'lg', surface: 'elevated', hero: 'split', button: 'solid', density: 'normal', headingStyle: 'plain' },
    { heading: 'serif', body: 'serif', radius: 'md', surface: 'flat', hero: 'minimal', button: 'soft', density: 'roomy', headingStyle: 'centered' },
  ],
  Creative: [
    { heading: 'display', body: 'sans', radius: 'none', surface: 'flat', hero: 'minimal', button: 'sharp', density: 'roomy', headingStyle: 'eyebrow' },
    { heading: 'mono', body: 'mono', radius: 'sm', surface: 'outlined', hero: 'split', button: 'outline', density: 'compact', headingStyle: 'uppercase' },
    { heading: 'serif', body: 'sans', radius: 'xl', surface: 'glass', hero: 'overlay', button: 'pill', density: 'roomy', headingStyle: 'centered' },
  ],
  Education: [
    { heading: 'serif', body: 'humanist', radius: 'md', surface: 'card', hero: 'banner', button: 'solid', density: 'normal', headingStyle: 'plain' },
    { heading: 'rounded', body: 'rounded', radius: 'xl', surface: 'elevated', hero: 'gradient', button: 'pill', density: 'normal', headingStyle: 'centered' },
    { heading: 'slab', body: 'sans', radius: 'sm', surface: 'outlined', hero: 'split', button: 'outline', density: 'compact', headingStyle: 'underline' },
  ],
  Hospitality: [
    { heading: 'serif', body: 'serif', radius: 'lg', surface: 'flat', hero: 'overlay', button: 'soft', density: 'roomy', headingStyle: 'centered' },
    { heading: 'display', body: 'sans', radius: 'md', surface: 'glass', hero: 'gradient', button: 'pill', density: 'normal', headingStyle: 'eyebrow' },
    { heading: 'sans', body: 'humanist', radius: 'xl', surface: 'card', hero: 'banner', button: 'solid', density: 'normal', headingStyle: 'plain' },
  ],
  Events: [
    { heading: 'display', body: 'sans', radius: 'full', surface: 'elevated', hero: 'gradient', button: 'pill', density: 'normal', headingStyle: 'centered' },
    { heading: 'grotesk', body: 'sans', radius: 'none', surface: 'flat', hero: 'banner', button: 'sharp', density: 'compact', headingStyle: 'uppercase' },
    { heading: 'serif', body: 'sans', radius: 'lg', surface: 'glass', hero: 'overlay', button: 'soft', density: 'roomy', headingStyle: 'underline' },
  ],
  General: [
    { heading: 'sans', body: 'sans', radius: 'md', surface: 'card', hero: 'centered', button: 'solid', density: 'normal', headingStyle: 'plain' },
    { heading: 'grotesk', body: 'sans', radius: 'sm', surface: 'outlined', hero: 'minimal', button: 'outline', density: 'compact', headingStyle: 'uppercase' },
    { heading: 'serif', body: 'sans', radius: 'lg', surface: 'flat', hero: 'split', button: 'soft', density: 'roomy', headingStyle: 'underline' },
    { heading: 'rounded', body: 'rounded', radius: 'xl', surface: 'elevated', hero: 'gradient', button: 'pill', density: 'normal', headingStyle: 'centered' },
  ],
};

/** Name pools per category — evocative, not numbered. */
const NAMES = {
  Restaurant: ['Ember', 'Harvest', 'Trattoria', 'Skillet', 'Basil', 'Cardamom', 'Larder', 'Brasserie', 'Tandoor', 'Griddle', 'Copperpot', 'Sourdough'],
  'Salon & Spa': ['Lotus', 'Silk', 'Bloom', 'Aura', 'Petal', 'Onsen', 'Velvet', 'Marble', 'Cocoon', 'Serenity'],
  Retail: ['Bazaar', 'Counter', 'Emporium', 'Kiosk', 'Boutique', 'Stockroom', 'Market', 'Parcel', 'Aisle', 'Trolley'],
  Professional: ['Ledger', 'Notary', 'Chambers', 'Meridian', 'Counsel', 'Atlas', 'Beacon', 'Quorum', 'Bureau'],
  'Health & Fitness': ['Pulse', 'Kinetic', 'Vital', 'Summit', 'Stride', 'Wellspring', 'Cadence', 'Restore', 'Marathon'],
  'Home Services': ['Toolbox', 'Rafter', 'Anvil', 'Groundwork', 'Keystone', 'Workshop', 'Hearth', 'Ladder'],
  'Real Estate': ['Terrace', 'Homestead', 'Portico', 'Landmark', 'Cottage', 'Skyline', 'Threshold', 'Courtyard'],
  Creative: ['Exposure', 'Darkroom', 'Canvas', 'Studio', 'Palette', 'Reel', 'Contact Sheet', 'Easel'],
  Education: ['Scholar', 'Abacus', 'Almanac', 'Lantern', 'Compass', 'Chalk', 'Quill', 'Syllabus'],
  Hospitality: ['Lodge', 'Voyage', 'Verandah', 'Wanderer', 'Harbour', 'Sojourn', 'Passport', 'Hideaway'],
  Events: ['Confetti', 'Marquee', 'Gala', 'Encore', 'Fanfare', 'Soirée', 'Bouquet', 'Toast'],
  General: ['Signal', 'Plainly', 'Card', 'Origin', 'Standard', 'Everyday', 'Simple', 'Common', 'Direct', 'Baseline'],
};

const DESCRIPTIONS = {
  Restaurant: 'Warm and appetising, built for menus and table-side scanning.',
  'Salon & Spa': 'Calm and unhurried, with plenty of breathing room.',
  Retail: 'Direct and product-forward, easy to scan on the shop floor.',
  Professional: 'Sober and credible, for practices that trade on trust.',
  'Health & Fitness': 'Energetic and legible, readable mid-session.',
  'Home Services': 'Sturdy and practical, for trades and callouts.',
  'Real Estate': 'Understated and photographic, built around a property shot.',
  Creative: 'Gallery-quiet, so the work is the loudest thing on the page.',
  Education: 'Clear and welcoming, for tutors, classes and academies.',
  Hospitality: 'Inviting and scenic, for stays, tours and getaways.',
  Events: 'Celebratory and bold, for bookings and big days.',
  General: 'A neutral starting point that suits any business.',
};

// ── build ─────────────────────────────────────────────────────────────────

const familyNames = Object.keys(FAMILIES);
const themes = [];
let familyIndex = 0;

for (const [category, presets] of Object.entries(PRESETS)) {
  const names = NAMES[category];
  for (let i = 0; i < names.length; i++) {
    const family = familyNames[familyIndex % familyNames.length];
    familyIndex += 1;
    const palette = FAMILIES[family];
    const preset = presets[i % presets.length];
    const name = names[i];

    themes.push({
      id: `${category.toLowerCase().replace(/[^a-z]+/g, '-')}-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      name,
      category,
      description: DESCRIPTIONS[category],
      palette,
      dark: palette.text === D.text,
      ...preset,
    });
  }
}

// ── verify every colour pair before emitting ──────────────────────────────

const failures = [];
for (const theme of themes) {
  const p = theme.palette;
  const checks = [
    ['text/bg', p.text, p.bg],
    ['text/surface', p.text, p.surface],
    ['muted/bg', p.muted, p.bg],
    ['muted/surface', p.muted, p.surface],
    ['accentText/accent', p.accentText, p.accent],
  ];
  for (const [label, a, b] of checks) {
    const ratio = contrast(a, b);
    if (ratio < 4.5) {
      failures.push(`${theme.name} (${theme.category}) ${label}: ${ratio.toFixed(2)}:1 — ${a} on ${b}`);
    }
  }
}

if (failures.length) {
  console.error(`Refusing to emit — ${failures.length} colour pairs fail WCAG AA (4.5:1):\n`);
  for (const f of [...new Set(failures)]) console.error('  ' + f);
  process.exit(1);
}

const file = `// AUTO-GENERATED by scripts/build-theme-catalog.mjs — do not edit by hand.
//
// Every colour pair below is verified against WCAG AA (4.5:1) at generation
// time; the generator refuses to emit if any pair fails.

import type { ThemeTokens } from './theme-tokens.ts';

export const THEME_CATALOG: ThemeTokens[] = ${JSON.stringify(themes, null, 2)};

/** Lookup by the theme's display name, which is what the database stores. */
export const THEME_BY_NAME = new Map<string, ThemeTokens>(
  THEME_CATALOG.map((theme) => [theme.name, theme]),
);
`;

const target = join(HERE, '..', 'src', 'theme-catalog.generated.ts');
writeFileSync(target, file, 'utf8');

const byCategory = themes.reduce((acc, t) => {
  acc[t.category] = (acc[t.category] ?? 0) + 1;
  return acc;
}, {});
console.log(`wrote ${themes.length} themes, all pairs >= 4.5:1`);
console.log(Object.entries(byCategory).map(([c, n]) => `  ${c}: ${n}`).join('\n'));

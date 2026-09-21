import { SOCIAL_LABEL, socialHref } from '../../social-buttons';
import { orDefault } from '../../theme-content';

import type { IconName } from '../../icon';
import type { PublicSocialLink, SocialPlatform, ThemeRenderProps } from '@vyaparqr/types';

/**
 * What a single-screen theme shows, derived once from the page data.
 *
 * The three themes differ in how they look, not in what they offer, so the
 * decisions — which quick actions fit on the screen, which sections move into
 * a sheet — live here and every theme gets them identically.
 */

/** Everything that opens in the bottom sheet rather than on the screen. */
export type PanelKey =
  | 'pay'
  | 'about'
  | 'menu'
  | 'order'
  | 'gallery'
  | 'locations'
  | 'offers'
  | 'book'
  | 'reviews'
  | 'loyalty'
  | 'enquire'
  | 'follow'
  | 'more';

export interface PanelInfo {
  key: PanelKey;
  label: string;
  icon: IconName;
}

export type QuickAction =
  | { kind: 'link'; id: string; label: string; href: string; icon: IconName | SocialPlatform; external: boolean }
  | { kind: 'panel'; id: string; label: string; panel: PanelKey; icon: IconName }
  | { kind: 'review'; id: string; label: string };

/** Sections whose content is fetched on the client, so only known after mount. */
export interface LiveSections {
  order: boolean;
  offers: boolean;
  slots: boolean;
}

export interface ScreenModel {
  headline: string;
  tagline: string;
  logoUrl: string;
  initials: string;
  hours: string;
  phone: string;
  address: string;
  rating: number | null;
  primary: { label: string; panel: 'pay' } | null;
  actions: QuickAction[];
  /** Sections for the dock, in priority order. */
  panels: PanelInfo[];
  socialLinks: PublicSocialLink[];
  /** Social links the action grid couldn't show (a duplicate platform, or
   * past the tile limit). Reachable from the Follow sheet. */
  socialRow: PublicSocialLink[];
}

/** How many sections fit in the dock before the last slot becomes "More". */
const MAX_ACTIONS = 4;

/**
 * The most action tiles the grid shows: three rows of three. Every tile —
 * Call, WhatsApp, Directions, Review, each social profile, Enquire — is the
 * same component in the same grid; past nine the grid would need a fourth row
 * the single screen doesn't have room for, and Enquire (the one action that
 * also lives in the dock) is the tile that gives way.
 */
const MAX_TILES = 9;

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}` : name.trim().slice(0, 2);
  return letters.toUpperCase() || 'VQ';
}

export function directionsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function buildScreenModel(props: ThemeRenderProps, live: LiveSections): ScreenModel {
  const { content, businessName, paymentMethods, socialLinks, reviewConfig, slug } = props;
  const hero = content.hero ?? {};
  const about = content.about ?? {};
  const menu = content.menu ?? {};
  const contact = content.contact ?? {};
  const galleryImages = props.galleryImages ?? [];
  const locations = [...(props.locations ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const testimonials = props.testimonials ?? [];
  const reviews = props.reviews ?? [];
  const links = [...socialLinks].sort((a, b) => a.displayOrder - b.displayOrder);

  const headline = orDefault(hero.headline, businessName);
  const phone = orDefault(about.phone, locations[0]?.phone ?? '');
  const address = orDefault(about.address, locations[0]?.address ?? '');
  const whatsapp = links.find((link) => link.platform === 'whatsapp');

  const candidates: QuickAction[] = [];
  if (phone) {
    candidates.push({ kind: 'link', id: 'call', label: 'Call', href: `tel:${phone.replace(/\s+/g, '')}`, icon: 'phone', external: false });
  }
  if (whatsapp) {
    candidates.push({ kind: 'link', id: 'whatsapp', label: 'WhatsApp', href: socialHref(whatsapp), icon: 'whatsapp', external: true });
  }
  if (address) {
    candidates.push({ kind: 'link', id: 'directions', label: 'Directions', href: directionsUrl(address), icon: 'navigation', external: true });
  }
  if (reviewConfig) {
    candidates.push({ kind: 'review', id: 'review', label: 'Review' });
  }
  /* Every social profile is a tile like the rest, in the same grid, at the
     same size. They used to be a separate row of small round icons under the
     actions — and before that they queued for one of only four slots and were
     usually pushed behind "More" — so the buttons a customer taps most looked
     like three different kinds of control. One per platform: a second
     Instagram link stays reachable from the Follow sheet, not as a duplicate
     tile. */
  /** The one link per platform that gets a tile. */
  const tiledLinkIds = new Set<string>(whatsapp ? [whatsapp.id] : []);
  for (const link of links) {
    if (link.platform === 'whatsapp') continue; // already a tile above
    if (candidates.some((action) => action.id === link.platform)) continue;
    tiledLinkIds.add(link.id);
    candidates.push({
      kind: 'link',
      id: link.platform,
      label: SOCIAL_LABEL[link.platform],
      href: socialHref(link),
      icon: link.platform,
      external: true,
    });
  }
  if (slug) {
    candidates.push({ kind: 'panel', id: 'enquire', label: 'Enquire', panel: 'enquire', icon: 'message' });
  }
  const actions = candidates.slice(0, MAX_TILES);
  const inActions = new Set(actions.map((action) => action.id));
  /* Links the grid couldn't show: a second profile on the same platform, or
     one cut by the nine-tile limit. They go to the Follow sheet. */
  const socialRow = links.filter((link) => !(tiledLinkIds.has(link.id) && inActions.has(link.platform)));

  const panels: PanelInfo[] = [];
  const add = (show: unknown, info: PanelInfo) => {
    if (show) panels.push(info);
  };
  add([about.description, about.hours, about.address, about.phone].some(Boolean), { key: 'about', label: 'About', icon: 'info' });
  add(menu.fileUrl, { key: 'menu', label: orDefault(menu.heading, 'Menu'), icon: 'book' });
  add(live.order, { key: 'order', label: 'Order', icon: 'bag' });
  add(galleryImages.length > 0, { key: 'gallery', label: 'Gallery', icon: 'image' });
  add(live.offers, { key: 'offers', label: 'Offers', icon: 'tag' });
  add(live.slots ? true : contact.bookingUrl, { key: 'book', label: 'Book', icon: 'calendar' });
  add(testimonials.length > 0 || reviews.length > 0, { key: 'reviews', label: 'Reviews', icon: 'quote' });
  add(locations.length > 1, { key: 'locations', label: 'Branches', icon: 'map-pin' });
  add(props.loyaltyActive && slug, { key: 'loyalty', label: 'Rewards', icon: 'gift' });
  add(slug && !inActions.has('enquire'), { key: 'enquire', label: 'Enquire', icon: 'message' });
  add(socialRow.length > 0, { key: 'follow', label: 'Follow', icon: 'heart' });

  const parsedRating = reviewConfig?.avgRatingCached ? Number(reviewConfig.avgRatingCached) : NaN;

  return {
    headline,
    tagline: hero.tagline ?? '',
    logoUrl: hero.logoUrl ?? '',
    initials: initialsOf(headline),
    hours: about.hours ?? '',
    phone,
    address,
    rating: Number.isFinite(parsedRating) && parsedRating > 0 ? parsedRating : null,
    primary: paymentMethods.length > 0 ? { label: 'Pay now', panel: 'pay' } : null,
    actions,
    panels,
    socialLinks: links,
    socialRow,
  };
}

/**
 * Splits sections between the dock and the "More" sheet. Four fit; with more
 * than four, three stay visible and the fourth slot becomes "More".
 */
export function splitDock(panels: PanelInfo[]): { dock: PanelInfo[]; overflow: PanelInfo[] } {
  if (panels.length <= MAX_ACTIONS) {
    return { dock: panels, overflow: [] };
  }
  return {
    dock: [...panels.slice(0, MAX_ACTIONS - 1), { key: 'more', label: 'More', icon: 'grid' }],
    overflow: panels.slice(MAX_ACTIONS - 1),
  };
}

/**
 * Black or white for text on an arbitrary client-chosen colour, by WCAG
 * relative luminance — a client can pick any hex, including ones that make
 * white text unreadable.
 */
export function readableOn(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return '#ffffff';

  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(Number.parseInt(full.slice(0, 2), 16)) +
    0.7152 * channel(Number.parseInt(full.slice(2, 4), 16)) +
    0.0722 * channel(Number.parseInt(full.slice(4, 6), 16));

  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#ffffff' : '#111111';
}

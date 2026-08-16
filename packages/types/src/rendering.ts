import type { ThemeContent } from './theme.ts';

export type PaymentMethodType = 'gpay' | 'phonepe' | 'paytm' | 'other';
export type SocialPlatform = 'whatsapp' | 'instagram' | 'facebook';

export interface PublicPaymentMethod {
  id: string;
  type: PaymentMethodType;
  qrImageUrl: string | null;
  upiId: string | null;
  displayOrder: number;
}

export interface PublicSocialLink {
  id: string;
  platform: SocialPlatform;
  value: string;
  displayOrder: number;
}

export interface PublicReviewConfig {
  reviewLink: string | null;
  avgRatingCached: string | null;
}

export interface PublicReviewItem {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  reviewDate: string;
}

export interface PublicGalleryImage {
  id: string;
  imageUrl: string;
  displayOrder: number;
}

export interface PublicLocation {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  hours: string | null;
  displayOrder: number;
}

export interface PublicTestimonial {
  id: string;
  authorName: string;
  quote: string;
  rating: number | null;
}

/** Everything a starter theme component needs to render a published landing page. */
export interface ThemeRenderProps {
  /** The client's slug, used by interactive components (contact form, review
   * funnel, click tracking) to know which landing page to post back to.
   * Optional because admin preview contexts may not have one yet. */
  slug?: string;
  businessName: string;
  content: ThemeContent;
  paymentMethods: PublicPaymentMethod[];
  socialLinks: PublicSocialLink[];
  reviewConfig: PublicReviewConfig | null;
  /** Cached reviews synced from the client's Google Sheet, newest first.
   * Defaults to an empty array where not yet fetched (e.g. admin previews). */
  reviews?: PublicReviewItem[];
  /** True when the client's plan includes white-label (P4-03) — themes hide
   * the "Powered by QRHub" footer line when this is set. */
  hideBranding?: boolean;
  /** Client-chosen accent color override (hex), null/undefined = the
   * theme's own default. See `accentColorStyle` in `@qrhub/ui`. */
  accentColor?: string | null;
  /** Gallery photo strip. Defaults to empty where not yet fetched (e.g.
   * admin previews that don't pass it). */
  galleryImages?: PublicGalleryImage[];
  /** Physical locations/branches. Defaults to empty where not yet fetched. */
  locations?: PublicLocation[];
  /** Client-curated, approved testimonials only. Defaults to empty where
   * not yet fetched. */
  testimonials?: PublicTestimonial[];
  /** Whether the client has an active loyalty/stamp-card program — themes
   * show a "View my loyalty card" link when true. */
  loyaltyActive?: boolean;
}

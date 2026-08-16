export type ThemeFieldType = 'text' | 'richtext' | 'image' | 'color' | 'boolean' | 'list' | 'document';

export interface ThemeField {
  key: string;
  label: string;
  type: ThemeFieldType;
  required?: boolean;
  placeholder?: string;
}

export type ThemeSectionKey = 'hero' | 'about' | 'menu' | 'locations' | 'payment' | 'reviews' | 'testimonials' | 'social' | 'contact' | 'footer';

export interface ThemeSection {
  key: ThemeSectionKey;
  label: string;
  /** Editable fields for this section. Sections like `payment`/`social`/`reviews`
   * pull their real data from relational tables (PaymentMethod, SocialLink,
   * ReviewCache) — their fields here are just section-level copy (heading text). */
  fields: ThemeField[];
}

export interface ThemeSchema {
  sections: ThemeSection[];
}

/** The single shared section/field layout used by every starter theme.
 * Themes differ in visual presentation, not in what content they collect. */
export const DEFAULT_THEME_SCHEMA: ThemeSchema = {
  sections: [
    {
      key: 'hero',
      label: 'Hero',
      fields: [
        { key: 'logoUrl', label: 'Logo', type: 'image' },
        { key: 'backgroundImageUrl', label: 'Background image', type: 'image' },
        { key: 'headline', label: 'Headline', type: 'text', required: true, placeholder: 'Your business name' },
        { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'A short one-line description' },
      ],
    },
    {
      key: 'about',
      label: 'About',
      fields: [
        { key: 'description', label: 'Description', type: 'richtext' },
        { key: 'address', label: 'Address', type: 'text' },
        { key: 'hours', label: 'Business hours', type: 'text', placeholder: 'Mon–Sat, 10am–8pm' },
        { key: 'phone', label: 'Phone number', type: 'text' },
      ],
    },
    {
      key: 'menu',
      label: 'Menu / Brochure',
      fields: [
        { key: 'heading', label: 'Section heading', type: 'text', placeholder: 'Menu' },
        { key: 'fileUrl', label: 'Menu or brochure file (image or PDF)', type: 'document' },
      ],
    },
    {
      key: 'locations',
      label: 'Locations',
      fields: [{ key: 'heading', label: 'Section heading', type: 'text', placeholder: 'Our locations' }],
    },
    {
      key: 'payment',
      label: 'Payment',
      fields: [{ key: 'heading', label: 'Section heading', type: 'text', placeholder: 'Pay us' }],
    },
    {
      key: 'reviews',
      label: 'Reviews',
      fields: [{ key: 'heading', label: 'Section heading', type: 'text', placeholder: 'Rate us' }],
    },
    {
      key: 'testimonials',
      label: 'Testimonials',
      fields: [{ key: 'heading', label: 'Section heading', type: 'text', placeholder: 'What people say' }],
    },
    {
      key: 'social',
      label: 'Social',
      fields: [{ key: 'heading', label: 'Section heading', type: 'text', placeholder: 'Follow us' }],
    },
    {
      key: 'contact',
      label: 'Contact',
      fields: [
        { key: 'heading', label: 'Section heading', type: 'text', placeholder: 'Get in touch' },
        { key: 'bookingUrl', label: 'Booking link (Calendly, etc.)', type: 'text', placeholder: 'https://calendly.com/your-business' },
      ],
    },
    {
      key: 'footer',
      label: 'Footer',
      fields: [{ key: 'text', label: 'Footer text', type: 'text' }],
    },
  ],
};

export type ThemeSectionContent = Record<string, string>;

/** `content_json` shape: section key -> field key -> value. */
export type ThemeContent = Partial<Record<ThemeSectionKey, ThemeSectionContent>>;

export interface SeoMeta {
  title?: string;
  description?: string;
  ogImage?: string;
}

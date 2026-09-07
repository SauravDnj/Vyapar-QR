import { BookingButton } from '../booking-button';
import { BookingSlotsWidget } from '../booking-slots-widget';
import { ContactForm } from '../contact-form';
import { CouponsList } from '../coupons-list';
import { DocumentViewer } from '../document-viewer';
import { GalleryGrid } from '../gallery-grid';
import { Icon } from '../icon';
import { LocationsList } from '../locations-list';
import { LoyaltyCardLink } from '../loyalty-card-link';
import { MenuOrder } from '../menu-order';
import { PaymentButtons } from '../payment-buttons';
import { Reveal } from '../reveal';
import { ReviewFunnel } from '../review-funnel';
import { ReviewsDisplay } from '../reviews-display';
import { SaveContactButton } from '../save-contact-button';
import { ShareButton } from '../share-button';
import { SocialButtons } from '../social-buttons';
import { TestimonialForm } from '../testimonial-form';
import { TestimonialsWall } from '../testimonials-wall';
import { orDefault } from '../theme-content';

import { FONT_STACKS, RADIUS, SPACING } from './token-styles';

import type { ThemeRenderProps, ThemeTokens } from '@qrhub/types';
import type { CSSProperties } from 'react';

/**
 * Renders any token-defined theme.
 *
 * Every visual decision comes from `tokens`, expressed as CSS custom
 * properties on the page root. Section markup is identical across the whole
 * catalog, so a new section is written once and every theme gets it.
 *
 * Colours are inline custom properties rather than Tailwind classes because
 * they are per-theme runtime values — Tailwind can only emit classes it can
 * see at build time, and a hundred palettes are data, not source.
 */
export function TokenTheme({
  tokens,
  slug,
  businessName,
  content,
  paymentMethods,
  socialLinks,
  reviewConfig,
  reviews = [],
  hideBranding,
  accentColor,
  galleryImages = [],
  locations = [],
  testimonials = [],
  loyaltyActive,
}: { tokens: ThemeTokens } & ThemeRenderProps) {
  const hero = content.hero ?? {};
  const about = content.about ?? {};
  const menu = content.menu ?? {};
  const locationsCopy = content.locations ?? {};
  const payment = content.payment ?? {};
  const reviewsCopy = content.reviews ?? {};
  const testimonialsCopy = content.testimonials ?? {};
  const social = content.social ?? {};
  const contact = content.contact ?? {};
  const footer = content.footer ?? {};

  const { palette } = tokens;
  // A client-chosen accent overrides the theme's own, which is why accent text
  // is not baked in: it is recomputed for whichever colour actually wins.
  const accent = accentColor ?? palette.accent;

  const rootStyle = {
    '--t-bg': palette.bg,
    '--t-surface': palette.surface,
    '--t-text': palette.text,
    '--t-muted': palette.muted,
    '--t-accent': accent,
    '--t-accent-text': accentColor ? readableOn(accentColor) : palette.accentText,
    '--t-border': palette.border,
    '--t-radius': RADIUS[tokens.radius],
    '--t-gap': SPACING[tokens.density].gap,
    '--t-pad': SPACING[tokens.density].pad,
    '--t-font-heading': FONT_STACKS[tokens.heading],
    '--t-font-body': FONT_STACKS[tokens.body],
    backgroundColor: 'var(--t-bg)',
    color: 'var(--t-text)',
    fontFamily: 'var(--t-font-body)',
  } as CSSProperties;

  return (
    <div style={rootStyle} className="qr-theme min-h-screen">
      <div className="mx-auto w-full max-w-xl px-5 pb-16 sm:px-6 lg:max-w-2xl">
        <Hero tokens={tokens} businessName={businessName} hero={hero} />

        <div className="flex flex-col" style={{ gap: 'var(--t-gap)' }}>
          {about.description || about.address || about.hours || about.phone ? (
            <Section tokens={tokens} title={about.heading ?? 'About'}>
              {about.description ? (
                <p className="whitespace-pre-line leading-relaxed">{about.description}</p>
              ) : null}
              <dl className="mt-4 flex flex-col gap-3">
                <Detail icon="map-pin" label="Address" value={about.address} />
                <Detail icon="clock" label="Hours" value={about.hours} />
                <Detail icon="phone" label="Phone" value={about.phone} href={about.phone ? `tel:${about.phone}` : undefined} />
              </dl>
            </Section>
          ) : null}

          {galleryImages.length > 0 ? (
            <Section tokens={tokens} title="Gallery">
              <GalleryGrid images={galleryImages} />
            </Section>
          ) : null}

          {menu.fileUrl ? (
            <Section tokens={tokens} title={menu.heading ?? 'Menu'}>
              <DocumentViewer url={menu.fileUrl} label={orDefault(menu.heading, 'Menu')} />
            </Section>
          ) : null}

          {slug ? (
            <Section tokens={tokens} title={menu.heading ?? 'Order'} collapseWhenEmpty>
              <MenuOrder slug={slug} />
            </Section>
          ) : null}

          {locations.length > 0 ? (
            <Section tokens={tokens} title={locationsCopy.heading ?? 'Find us'}>
              <LocationsList locations={locations} />
            </Section>
          ) : null}

          {paymentMethods.length > 0 ? (
            <Section tokens={tokens} title={payment.heading ?? 'Pay us'}>
              <PaymentButtons slug={slug} businessName={businessName} paymentMethods={paymentMethods} />
            </Section>
          ) : null}

          {reviewConfig ? (
            <Section tokens={tokens} title={reviewsCopy.heading ?? 'Rate your experience'}>
              <ReviewFunnel slug={slug} />
              <ReviewsDisplay reviews={reviews} />
            </Section>
          ) : null}

          {testimonials.length > 0 || slug ? (
            <Section tokens={tokens} title={testimonialsCopy.heading ?? 'What people say'}>
              <TestimonialsWall testimonials={testimonials} />
              {slug ? <TestimonialForm slug={slug} /> : null}
            </Section>
          ) : null}

          {slug ? (
            <>
              <Section tokens={tokens} title="Offers" collapseWhenEmpty>
                <CouponsList slug={slug} />
              </Section>
              <Section tokens={tokens} title="Book a time" collapseWhenEmpty>
                <BookingSlotsWidget slug={slug} />
              </Section>
            </>
          ) : null}

          {loyaltyActive && slug ? (
            <Section tokens={tokens} title="Loyalty">
              <LoyaltyCardLink slug={slug} active={loyaltyActive} />
            </Section>
          ) : null}

          {socialLinks.length > 0 ? (
            <Section tokens={tokens} title={social.heading ?? 'Follow us'}>
              <SocialButtons slug={slug} socialLinks={socialLinks} />
            </Section>
          ) : null}

          <Section tokens={tokens} title={contact.heading ?? 'Get in touch'}>
            <div className="flex flex-col gap-4">
              {slug ? <ContactForm slug={slug} /> : null}
              <div className="flex flex-wrap gap-2">
                <SaveContactButton businessName={businessName} phone={about.phone} address={about.address} />
                <ShareButton businessName={businessName} />
                {contact.bookingUrl ? <BookingButton url={contact.bookingUrl} /> : null}
              </div>

            </div>
          </Section>
        </div>

        <footer
          className="mt-12 border-t pt-6 text-center text-sm"
          style={{ borderColor: 'var(--t-border)', color: 'var(--t-muted)' }}
        >
          <p>{orDefault(footer.note, `© ${businessName}`)}</p>
          {hideBranding ? null : <p className="mt-1 opacity-70">Powered by QRHub</p>}
        </footer>
      </div>
    </div>
  );
}

/** Section heading plus its surface treatment. */
function Section({
  tokens,
  title,
  children,
  collapseWhenEmpty,
}: {
  tokens: ThemeTokens;
  title: string;
  children: React.ReactNode;
  /** For sections whose body fetches its own data and may render nothing. */
  collapseWhenEmpty?: boolean;
}) {
  const surfaceStyle: CSSProperties =
    tokens.surface === 'flat'
      ? {}
      : {
          backgroundColor:
            tokens.surface === 'glass' ? 'color-mix(in srgb, var(--t-surface) 82%, transparent)' : 'var(--t-surface)',
          borderRadius: 'var(--t-radius)',
          padding: 'var(--t-pad)',
          border:
            tokens.surface === 'outlined' || tokens.surface === 'glass'
              ? '1px solid var(--t-border)'
              : undefined,
          boxShadow:
            tokens.surface === 'elevated'
              ? '0 10px 30px -12px rgb(0 0 0 / 0.25)'
              : tokens.surface === 'card'
                ? '0 1px 3px rgb(0 0 0 / 0.08)'
                : undefined,
          backdropFilter: tokens.surface === 'glass' ? 'blur(10px)' : undefined,
        };

  return (
    <Reveal>
      <section
        style={surfaceStyle}
        className={collapseWhenEmpty ? 'empty:hidden [&:has(>*:empty)]:hidden' : undefined}
      >
        <SectionTitle tokens={tokens}>{title}</SectionTitle>
        <div className="mt-3">{children}</div>
      </section>
    </Reveal>
  );
}

function SectionTitle({ tokens, children }: { tokens: ThemeTokens; children: React.ReactNode }) {
  const base = 'font-semibold';
  const style: CSSProperties = { fontFamily: 'var(--t-font-heading)', color: 'var(--t-text)' };

  switch (tokens.headingStyle) {
    case 'uppercase':
      return (
        <h2 className={`${base} text-xs tracking-[0.18em] uppercase`} style={{ ...style, color: 'var(--t-muted)' }}>
          {children}
        </h2>
      );
    case 'underline':
      return (
        <h2 className={`${base} text-lg`} style={style}>
          <span className="pb-1" style={{ borderBottom: '2px solid var(--t-accent)' }}>
            {children}
          </span>
        </h2>
      );
    case 'centered':
      return (
        <h2 className={`${base} text-center text-lg`} style={style}>
          {children}
        </h2>
      );
    case 'eyebrow':
      return (
        <div>
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--t-accent)' }}>
            {children}
          </span>
        </div>
      );
    default:
      return (
        <h2 className={`${base} text-lg`} style={style}>
          {children}
        </h2>
      );
  }
}

/** One labelled fact in the About block. Real icons, never letter avatars. */
function Detail({
  icon,
  label,
  value,
  href,
}: {
  icon: 'map-pin' | 'clock' | 'phone';
  label: string;
  value?: string;
  href?: string;
}) {
  if (!value) return null;

  const body = (
    <>
      <dt className="sr-only">{label}</dt>
      <dd className="leading-relaxed">{value}</dd>
    </>
  );

  return (
    <div className="flex items-start gap-3">
      <Icon name={icon} className="mt-0.5 size-5 shrink-0" style={{ color: 'var(--t-accent)' }} />
      <div className="min-w-0 flex-1">
        {href ? (
          <a href={href} className="underline-offset-2 hover:underline">
            {body}
          </a>
        ) : (
          body
        )}
      </div>
    </div>
  );
}

function Hero({
  tokens,
  businessName,
  hero,
}: {
  tokens: ThemeTokens;
  businessName: string;
  hero: Record<string, string | undefined>;
}) {
  const headline = orDefault(hero.headline, businessName);
  const hasImage = Boolean(hero.backgroundImageUrl);
  const variant = hasImage ? 'overlay' : tokens.hero;

  const logo = hero.logoUrl ? (
    <img
      src={hero.logoUrl}
      alt=""
      className="size-16 shrink-0 object-cover"
      style={{ borderRadius: tokens.radius === 'full' ? '9999px' : 'var(--t-radius)' }}
    />
  ) : null;

  const title = (
    <h1
      className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
      style={{ fontFamily: 'var(--t-font-heading)' }}
    >
      {headline}
    </h1>
  );

  const tagline = hero.tagline ? (
    <p className="text-base leading-relaxed text-pretty" style={{ color: 'var(--t-muted)' }}>
      {hero.tagline}
    </p>
  ) : null;

  if (variant === 'overlay') {
    return (
      <header
        className="relative mb-10 flex flex-col items-center gap-3 overflow-hidden px-6 py-16 text-center text-white"
        style={{
          borderRadius: 'var(--t-radius)',
          backgroundImage: `url(${hero.backgroundImageUrl ?? ''})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Scrim: photos are user-supplied, so text needs a guaranteed floor
            of contrast rather than luck with a bright image. */}
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          {logo}
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl" style={{ fontFamily: 'var(--t-font-heading)' }}>
            {headline}
          </h1>
          {hero.tagline ? <p className="text-white/85">{hero.tagline}</p> : null}
        </div>
      </header>
    );
  }

  if (variant === 'split') {
    return (
      <header className="mb-10 flex items-center gap-4 py-10">
        {logo}
        <div className="flex min-w-0 flex-col gap-1">
          {title}
          {tagline}
        </div>
      </header>
    );
  }

  const banded = variant === 'banner' || variant === 'gradient';

  return (
    <header
      className={`mb-10 flex flex-col items-center gap-3 text-center ${banded ? 'px-6 py-14' : 'py-12'}`}
      style={
        banded
          ? {
              borderRadius: 'var(--t-radius)',
              background:
                variant === 'gradient'
                  ? 'linear-gradient(140deg, var(--t-accent), color-mix(in srgb, var(--t-accent) 45%, var(--t-surface)))'
                  : 'var(--t-accent)',
              color: 'var(--t-accent-text)',
            }
          : undefined
      }
    >
      {logo}
      {title}
      {banded && hero.tagline ? (
        <p className="text-base opacity-90">{hero.tagline}</p>
      ) : (
        tagline
      )}
    </header>
  );
}

/**
 * Picks black or white for text on an arbitrary client-chosen accent, using
 * the WCAG relative-luminance threshold rather than eyeballing it — a client
 * can set any hex, including ones that make white text unreadable.
 */
function readableOn(hex: string): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6) return '#ffffff';

  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(Number.parseInt(full.slice(0, 2), 16));
  const g = channel(Number.parseInt(full.slice(2, 4), 16));
  const b = channel(Number.parseInt(full.slice(4, 6), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Contrast against white vs black; pick whichever is higher.
  return (1.05) / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#ffffff' : '#111111';
}

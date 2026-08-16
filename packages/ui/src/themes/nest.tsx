import { BookingButton } from '../booking-button';
import { BookingSlotsWidget } from '../booking-slots-widget';
import { ContactForm } from '../contact-form';
import { CouponsList } from '../coupons-list';
import { DocumentViewer } from '../document-viewer';
import { GalleryGrid } from '../gallery-grid';
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
import { accentColorStyle, orDefault } from '../theme-content';

import type { ThemeRenderProps } from '@qrhub/types';

/** Nest's default accent is a warm brass/bronze — evocative of real-estate
 * signage and property-brochure branding — preserved as the CSS var's
 * fallback so a client who hasn't picked a color still gets this look. */
const ACCENT = 'var(--theme-accent,#a16207)';

/** A slim, full-width accent bar used between sections instead of a plain
 * border — a quiet signature element that keeps the page feeling like a
 * single continuous property listing rather than stacked cards. */
function Divider() {
  return (
    <div className="flex justify-center">
      <span className="h-px w-16 opacity-40" style={{ backgroundColor: ACCENT }} />
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <h2 className="text-center text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: ACCENT }}>
      {children}
    </h2>
  );
}

export function NestTheme({
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
}: ThemeRenderProps) {
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

  return (
    <div
      className="mx-auto flex max-w-md flex-col gap-16 px-6 py-20 text-stone-800"
      style={{ ...accentColorStyle(accentColor), backgroundColor: '#faf8f5' }}
    >
      <Reveal>
        <header
          className={`flex flex-col items-center gap-4 text-center ${hero.backgroundImageUrl ? 'relative overflow-hidden rounded-sm px-6 py-16 text-white' : ''}`}
          style={
            hero.backgroundImageUrl
              ? { backgroundImage: `url(${hero.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {hero.backgroundImageUrl ? <div className="absolute inset-0 bg-black/45" /> : null}
          <div className={hero.backgroundImageUrl ? 'relative z-10 flex flex-col items-center gap-4' : 'contents'}>
            {hero.logoUrl ? (
              <img
                src={hero.logoUrl}
                alt={businessName}
                className="h-20 w-20 rounded-full border object-cover"
                style={{ borderColor: ACCENT }}
              />
            ) : null}
            <span
              className="text-xs font-semibold uppercase tracking-[0.3em]"
              style={{ color: hero.backgroundImageUrl ? '#fff' : ACCENT }}
            >
              Real Estate
            </span>
            <h1
              className={`font-serif text-4xl font-medium tracking-tight ${hero.backgroundImageUrl ? 'text-white' : 'text-stone-900'}`}
            >
              {orDefault(hero.headline, businessName)}
            </h1>
            {hero.tagline ? (
              <p className={`max-w-xs text-sm ${hero.backgroundImageUrl ? 'text-white/80' : 'text-stone-500'}`}>{hero.tagline}</p>
            ) : null}
          </div>
        </header>
      </Reveal>

      {about.description || about.address || about.hours || about.phone ? (
        <>
          <Divider />
          <Reveal>
            <section className="flex flex-col gap-4 text-center">
              <Eyebrow>About</Eyebrow>
              <div className="flex flex-col gap-2 text-sm leading-relaxed text-stone-600">
                {about.description ? <p className="font-serif text-base text-stone-700">{about.description}</p> : null}
                {about.address ? <p>{about.address}</p> : null}
                {about.hours ? <p>{about.hours}</p> : null}
                {about.phone ? <p>{about.phone}</p> : null}
              </div>
            </section>
          </Reveal>
        </>
      ) : null}

      {menu.fileUrl ? (
        <>
          <Divider />
          <Reveal>
            <section className="flex flex-col gap-4">
              <Eyebrow>{orDefault(menu.heading, 'Listings & Brochure')}</Eyebrow>
              <DocumentViewer url={menu.fileUrl} label={orDefault(menu.heading, 'Brochure')} />
            </section>
          </Reveal>
        </>
      ) : null}

      {galleryImages.length > 0 ? (
        <>
          <Divider />
          <Reveal>
            <section className="flex flex-col gap-4">
              <Eyebrow>Gallery</Eyebrow>
              <GalleryGrid images={galleryImages} />
            </section>
          </Reveal>
        </>
      ) : null}

      {locations.length > 0 ? (
        <>
          <Divider />
          <Reveal>
            <section className="flex flex-col gap-4">
              <Eyebrow>{orDefault(locationsCopy.heading, 'Our locations')}</Eyebrow>
              <LocationsList locations={locations} />
            </section>
          </Reveal>
        </>
      ) : null}

      <Divider />
      <Reveal>
        <CouponsList slug={slug} />
      </Reveal>

      <Reveal>
        <MenuOrder slug={slug} />
      </Reveal>

      {paymentMethods.length > 0 ? (
        <>
          <Divider />
          <Reveal>
            <section className="flex flex-col gap-4">
              <Eyebrow>{orDefault(payment.heading, 'Pay us')}</Eyebrow>
              <PaymentButtons slug={slug} businessName={businessName} paymentMethods={paymentMethods} />
            </section>
          </Reveal>
        </>
      ) : null}

      {reviewConfig?.reviewLink || slug ? (
        <>
          <Divider />
          <Reveal>
            <section
              className="flex flex-col items-center gap-4 rounded-sm border px-6 py-10 text-center"
              style={{ borderColor: ACCENT }}
            >
              <Eyebrow>{orDefault(reviewsCopy.heading, 'Client Reviews')}</Eyebrow>
              {reviewConfig?.avgRatingCached ? (
                <p className="font-serif text-2xl font-medium" style={{ color: ACCENT }}>
                  ★ {reviewConfig.avgRatingCached}
                </p>
              ) : null}
              <ReviewsDisplay reviews={reviews} />
              <ReviewFunnel slug={slug} />
            </section>
          </Reveal>
        </>
      ) : null}

      {testimonials.length > 0 || slug ? (
        <>
          <Divider />
          <Reveal>
            <section
              className="flex flex-col items-center gap-4 rounded-sm border px-6 py-10 text-center"
              style={{ borderColor: ACCENT }}
            >
              <Eyebrow>{orDefault(testimonialsCopy.heading, 'What people say')}</Eyebrow>
              <TestimonialsWall testimonials={testimonials} />
              <TestimonialForm slug={slug} />
            </section>
          </Reveal>
        </>
      ) : null}

      {socialLinks.length > 0 ? (
        <>
          <Divider />
          <Reveal>
            <section className="flex flex-col items-center gap-4">
              <Eyebrow>{orDefault(social.heading, 'Follow us')}</Eyebrow>
              <SocialButtons slug={slug} socialLinks={socialLinks} />
            </section>
          </Reveal>
        </>
      ) : null}

      {contact.heading || about.phone || slug ? (
        <>
          <Divider />
          <Reveal>
            <section className="flex flex-col items-center gap-5 text-center">
              <Eyebrow>{orDefault(contact.heading, 'Schedule a Viewing')}</Eyebrow>
              {about.phone ? <p className="text-sm text-stone-600">{about.phone}</p> : null}
              {contact.bookingUrl ? (
                <div className="w-full max-w-xs">
                  <BookingButton url={contact.bookingUrl} slug={slug} accentStyle={{ backgroundColor: ACCENT }} />
                </div>
              ) : null}
              <BookingSlotsWidget slug={slug} />
              <SaveContactButton businessName={businessName} phone={about.phone} address={about.address} />
              <div className="w-full max-w-xs">
                <ContactForm slug={slug} />
              </div>
            </section>
          </Reveal>
        </>
      ) : null}

      <footer className="flex flex-col items-center gap-2 pt-4 text-center text-xs text-stone-400">
        <ShareButton businessName={businessName} />
        <LoyaltyCardLink slug={slug} active={loyaltyActive} />
        <span>{orDefault(footer.text, `© ${businessName}`)}</span>
        {!hideBranding ? <span>Powered by QRHub</span> : null}
      </footer>
    </div>
  );
}

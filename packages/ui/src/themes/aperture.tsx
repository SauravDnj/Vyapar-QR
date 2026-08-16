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

/** Aperture's default accent is a punchy rose — a single vivid highlight
 * against the near-black gallery backdrop, used sparingly so the client's
 * own photography stays the star. */
const ACCENT = 'var(--theme-accent,#e11d48)';

/** A thin 1px accent-colored rule, used throughout in place of boxes or
 * heavy borders — this theme's signature "gallery catalog" divider. */
function Rule({ className = '' }: { className?: string }) {
  return <div className={`h-px w-10 ${className}`} style={{ backgroundColor: ACCENT }} />;
}

export function ApertureTheme({
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
    <div className="flex flex-col bg-[#0a0a0a] font-light text-gray-200" style={accentColorStyle(accentColor)}>
      <Reveal>
        <header
          className={`flex flex-col items-center gap-6 px-6 py-24 text-center ${hero.backgroundImageUrl ? 'relative overflow-hidden' : ''}`}
          style={
            hero.backgroundImageUrl
              ? { backgroundImage: `url(${hero.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {hero.backgroundImageUrl ? <div className="absolute inset-0 bg-black/30" /> : null}
          <div className={hero.backgroundImageUrl ? 'relative z-10 flex flex-col items-center gap-6' : 'contents'}>
            {hero.logoUrl ? (
              <img
                src={hero.logoUrl}
                alt={businessName}
                className="h-36 w-36 rounded-sm object-cover sm:h-40 sm:w-40"
              />
            ) : null}
            <div className="flex flex-col items-center gap-4">
              <h1 className="text-3xl font-extralight tracking-wide text-white sm:text-4xl">
                {orDefault(hero.headline, businessName)}
              </h1>
              <Rule />
              {hero.tagline ? (
                <p
                  className={`max-w-xs text-sm font-light uppercase tracking-[0.2em] ${hero.backgroundImageUrl ? 'text-white/80' : 'text-gray-400'}`}
                >
                  {hero.tagline}
                </p>
              ) : null}
            </div>
          </div>
        </header>
      </Reveal>

      <div className="mx-auto flex w-full max-w-md flex-col gap-16 px-6 pb-20">
        {about.description || about.address || about.hours || about.phone ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4 text-center">
              <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-gray-500">about</h2>
              <div className="flex flex-col gap-2 text-sm font-light text-gray-300">
                {about.description ? <p>{about.description}</p> : null}
                {about.address ? <p className="text-gray-400">{about.address}</p> : null}
                {about.hours ? <p className="text-gray-400">{about.hours}</p> : null}
                {about.phone ? <p className="text-gray-400">{about.phone}</p> : null}
              </div>
            </section>
          </Reveal>
        ) : null}

        {menu.fileUrl ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4">
              <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-gray-500">
                {orDefault(menu.heading, 'Portfolio')}
              </h2>
              <div className="w-full">
                <DocumentViewer url={menu.fileUrl} label={orDefault(menu.heading, 'Portfolio')} />
              </div>
            </section>
          </Reveal>
        ) : null}

        {galleryImages.length > 0 ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4">
              <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-gray-500">gallery</h2>
              <GalleryGrid images={galleryImages} />
            </section>
          </Reveal>
        ) : null}

        {locations.length > 0 ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4">
              <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-gray-500">
                {orDefault(locationsCopy.heading, 'Our locations')}
              </h2>
              <LocationsList locations={locations} />
            </section>
          </Reveal>
        ) : null}

        <Reveal>
          <CouponsList slug={slug} />
        </Reveal>

        <Reveal>
          <MenuOrder slug={slug} />
        </Reveal>

        {paymentMethods.length > 0 ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4">
              <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-gray-500">
                {orDefault(payment.heading, 'Book a session')}
              </h2>
              <PaymentButtons slug={slug} businessName={businessName} paymentMethods={paymentMethods} />
            </section>
          </Reveal>
        ) : null}

        {reviewConfig?.reviewLink || slug ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4 border-t border-gray-800 pt-12 text-center">
              <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-gray-500">
                {orDefault(reviewsCopy.heading, 'Reviews')}
              </h2>
              {reviewConfig?.avgRatingCached ? (
                <p className="text-lg font-light" style={{ color: ACCENT }}>
                  ★ {reviewConfig.avgRatingCached}
                </p>
              ) : null}
              <ReviewsDisplay reviews={reviews} />
              <ReviewFunnel slug={slug} />
            </section>
          </Reveal>
        ) : null}

        {testimonials.length > 0 || slug ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4 border-t border-gray-800 pt-12 text-center">
              <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-gray-500">
                {orDefault(testimonialsCopy.heading, 'What people say')}
              </h2>
              <TestimonialsWall testimonials={testimonials} />
              <TestimonialForm slug={slug} />
            </section>
          </Reveal>
        ) : null}

        {socialLinks.length > 0 ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4">
              <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-gray-500">
                {orDefault(social.heading, 'Follow along')}
              </h2>
              <SocialButtons slug={slug} socialLinks={socialLinks} />
            </section>
          </Reveal>
        ) : null}

        {contact.heading || about.phone || slug ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4 border-t border-gray-800 pt-12 text-center text-sm text-gray-300">
              <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-gray-500">
                {orDefault(contact.heading, 'Get in touch')}
              </h2>
              {about.phone ? <p className="font-light text-gray-400">{about.phone}</p> : null}
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
        ) : null}
      </div>

      <footer className="flex flex-col items-center gap-2 border-t border-gray-800 py-8 text-center text-xs font-light tracking-wide text-gray-600">
        <ShareButton businessName={businessName} />
        <LoyaltyCardLink slug={slug} active={loyaltyActive} />
        <span>{orDefault(footer.text, `© ${businessName}`)}</span>
        {!hideBranding ? <span>Powered by QRHub</span> : null}
      </footer>
    </div>
  );
}

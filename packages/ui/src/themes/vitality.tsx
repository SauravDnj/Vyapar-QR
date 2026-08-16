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

/** Healthcare/Clinic/Fitness-category theme: calm, clinical-but-warm, built
 * around a teal-green accent, soft rounded-2xl cards, and pill badges for
 * at-a-glance info (hours, phone) — trustworthy without feeling cold. */
const ACCENT = 'var(--theme-accent,#0d9488)';

export function VitalityTheme({
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
    <div className="flex flex-col bg-white text-slate-700" style={accentColorStyle(accentColor)}>
      <Reveal>
        <header
          className={`flex flex-col items-center gap-3 rounded-b-[2.5rem] px-6 pb-12 pt-16 text-center ${hero.backgroundImageUrl ? 'relative overflow-hidden text-white' : ''}`}
          style={
            hero.backgroundImageUrl
              ? { backgroundImage: `url(${hero.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { backgroundColor: 'color-mix(in srgb, var(--theme-accent,#0d9488) 10%, white)' }
          }
        >
          {hero.backgroundImageUrl ? <div className="absolute inset-0 bg-black/45" /> : null}
          <div className={hero.backgroundImageUrl ? 'relative z-10 flex flex-col items-center gap-3' : 'contents'}>
            {hero.logoUrl ? (
              <img
                src={hero.logoUrl}
                alt={businessName}
                className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-sm"
              />
            ) : null}
            <h1 className={`text-2xl font-semibold tracking-tight ${hero.backgroundImageUrl ? 'text-white' : 'text-slate-900'}`}>
              {orDefault(hero.headline, businessName)}
            </h1>
            {hero.tagline ? (
              <p className={`max-w-xs text-sm ${hero.backgroundImageUrl ? 'text-white/80' : 'text-slate-500'}`}>{hero.tagline}</p>
            ) : null}
          </div>
        </header>
      </Reveal>

      <div className="mx-auto flex w-full max-w-md flex-col gap-12 px-6 py-14">
        {about.description || about.address || about.hours || about.phone ? (
          <Reveal>
            <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-6">
              {about.description ? <p className="text-center text-sm leading-relaxed text-slate-600">{about.description}</p> : null}
              <div className="flex flex-col gap-3 text-sm">
                {about.hours ? (
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide"
                      style={{ backgroundColor: ACCENT, color: 'white' }}
                    >
                      Hours
                    </span>
                    <span className="text-right text-slate-600">{about.hours}</span>
                  </div>
                ) : null}
                {about.address ? (
                  <div className="flex items-start justify-between gap-4">
                    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Address</span>
                    <span className="text-right text-slate-600">{about.address}</span>
                  </div>
                ) : null}
                {about.phone ? (
                  <div className="flex items-start justify-between gap-4">
                    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Phone</span>
                    <span className="text-right text-slate-600">{about.phone}</span>
                  </div>
                ) : null}
              </div>
            </section>
          </Reveal>
        ) : null}

        {menu.fileUrl ? (
          <Reveal>
            <section className="flex flex-col gap-4">
              <h2 className="text-center text-sm font-semibold tracking-tight text-slate-900">
                {orDefault(menu.heading, 'Services & Pricing')}
              </h2>
              <DocumentViewer url={menu.fileUrl} label={orDefault(menu.heading, 'Services & Pricing')} />
            </section>
          </Reveal>
        ) : null}

        {galleryImages.length > 0 ? (
          <Reveal>
            <section className="flex flex-col gap-4">
              <h2 className="text-center text-sm font-semibold tracking-tight text-slate-900">Gallery</h2>
              <GalleryGrid images={galleryImages} />
            </section>
          </Reveal>
        ) : null}

        {locations.length > 0 ? (
          <Reveal>
            <section className="flex flex-col gap-4">
              <h2 className="text-center text-sm font-semibold tracking-tight text-slate-900">
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
            <section className="flex flex-col gap-4">
              <h2 className="text-center text-sm font-semibold tracking-tight text-slate-900">{orDefault(payment.heading, 'Pay us')}</h2>
              <PaymentButtons slug={slug} businessName={businessName} paymentMethods={paymentMethods} />
            </section>
          </Reveal>
        ) : null}

        {reviewConfig?.reviewLink || slug ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 p-6 text-center">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">{orDefault(reviewsCopy.heading, 'Rate us')}</h2>
              {reviewConfig?.avgRatingCached ? (
                <p
                  className="rounded-full px-4 py-1 text-lg font-semibold"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--theme-accent,#0d9488) 12%, white)', color: ACCENT }}
                >
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
            <section className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 p-6 text-center">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                {orDefault(testimonialsCopy.heading, 'What people say')}
              </h2>
              <TestimonialsWall testimonials={testimonials} />
              <TestimonialForm slug={slug} />
            </section>
          </Reveal>
        ) : null}

        {socialLinks.length > 0 ? (
          <Reveal>
            <section className="flex flex-col gap-3">
              <h2 className="text-center text-sm font-semibold tracking-tight text-slate-900">{orDefault(social.heading, 'Follow us')}</h2>
              <SocialButtons slug={slug} socialLinks={socialLinks} />
            </section>
          </Reveal>
        ) : null}

        {contact.heading || about.phone || slug ? (
          <Reveal>
            <section
              className="flex flex-col items-center gap-4 rounded-2xl p-6 text-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--theme-accent,#0d9488) 8%, white)' }}
            >
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">{orDefault(contact.heading, 'Get in touch')}</h2>
              {about.phone ? <p className="text-sm text-slate-600">{about.phone}</p> : null}
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

      <footer className="flex flex-col items-center gap-2 pb-10 text-center text-xs text-slate-400">
        <ShareButton businessName={businessName} />
        <LoyaltyCardLink slug={slug} active={loyaltyActive} />
        <span>{orDefault(footer.text, `© ${businessName}`)}</span>
        {!hideBranding ? <span>Powered by QRHub</span> : null}
      </footer>
    </div>
  );
}

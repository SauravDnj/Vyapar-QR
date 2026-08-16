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

/** Ironclad's default accent is a safety-orange, tuned for automotive and
 * home-services trades (mechanics, garages, plumbers, electricians, HVAC,
 * locksmiths). Always resolved through the CSS var so a client's chosen
 * accent color overrides it. */
const ACCENT = 'var(--theme-accent,#ea580c)';

/** Small uppercase section label with a solid accent tab in front of it —
 * a recurring industrial/utilitarian motif used throughout this theme
 * instead of centered pill-style headings. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-2.5 w-8 flex-shrink-0" style={{ backgroundColor: ACCENT }} />
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{children}</h2>
    </div>
  );
}

export function IroncladTheme({
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
    <div className="flex flex-col bg-[#1c1c1e] text-white" style={accentColorStyle(accentColor)}>
      <Reveal>
        <header
          className={`flex flex-col items-center gap-5 border-b border-white/10 bg-[#141416] px-6 py-20 text-center ${
            hero.backgroundImageUrl ? 'relative overflow-hidden' : ''
          }`}
          style={
            hero.backgroundImageUrl
              ? { backgroundImage: `url(${hero.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {hero.backgroundImageUrl ? <div className="absolute inset-0 bg-black/45" /> : null}
          <div className={hero.backgroundImageUrl ? 'relative z-10 flex flex-col items-center gap-5' : 'contents'}>
            {hero.logoUrl ? (
              <img
                src={hero.logoUrl}
                alt={businessName}
                className="h-20 w-20 rounded-sm border-2 object-cover"
                style={{ borderColor: ACCENT }}
              />
            ) : null}
            <h1 className="text-4xl font-black uppercase leading-none tracking-tight text-white">
              {orDefault(hero.headline, businessName)}
            </h1>
            {hero.tagline ? (
              <p className="text-sm font-bold uppercase tracking-[0.15em]" style={{ color: ACCENT }}>
                {hero.tagline}
              </p>
            ) : null}
          </div>
        </header>
      </Reveal>

      <div className="h-2 w-full" style={{ backgroundColor: ACCENT }} />

      <div className="mx-auto flex w-full max-w-md flex-col gap-12 px-6 py-14">
        {about.description || about.address || about.hours || about.phone ? (
          <Reveal>
            <section className="flex flex-col gap-4">
              <SectionLabel>The Shop</SectionLabel>
              <div className="flex flex-col gap-2 border border-white/10 bg-[#242426] p-5 text-sm text-gray-300">
                {about.description ? <p className="font-medium text-white">{about.description}</p> : null}
                {about.address ? <p>{about.address}</p> : null}
                {about.hours ? <p>{about.hours}</p> : null}
                {about.phone ? <p>{about.phone}</p> : null}
              </div>
            </section>
          </Reveal>
        ) : null}

        {menu.fileUrl ? (
          <Reveal>
            <section className="flex flex-col gap-4">
              <SectionLabel>{orDefault(menu.heading, 'Services & Rates')}</SectionLabel>
              <DocumentViewer url={menu.fileUrl} label={orDefault(menu.heading, 'Services & Rates')} />
            </section>
          </Reveal>
        ) : null}

        {galleryImages.length > 0 ? (
          <Reveal>
            <section className="flex flex-col gap-4">
              <SectionLabel>Gallery</SectionLabel>
              <GalleryGrid images={galleryImages} />
            </section>
          </Reveal>
        ) : null}

        {locations.length > 0 ? (
          <Reveal>
            <section className="flex flex-col gap-4">
              <SectionLabel>{orDefault(locationsCopy.heading, 'Our locations')}</SectionLabel>
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
              <SectionLabel>{orDefault(payment.heading, 'Pay us')}</SectionLabel>
              <PaymentButtons slug={slug} businessName={businessName} paymentMethods={paymentMethods} />
            </section>
          </Reveal>
        ) : null}

        {reviewConfig?.reviewLink || slug ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4 border-2 p-6 text-center" style={{ borderColor: ACCENT }}>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                {orDefault(reviewsCopy.heading, 'Rate us')}
              </h2>
              {reviewConfig?.avgRatingCached ? (
                <p className="text-2xl font-black" style={{ color: ACCENT }}>
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
            <section className="flex flex-col items-center gap-4 border-2 p-6 text-center" style={{ borderColor: ACCENT }}>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                {orDefault(testimonialsCopy.heading, 'What people say')}
              </h2>
              <TestimonialsWall testimonials={testimonials} />
              <TestimonialForm slug={slug} />
            </section>
          </Reveal>
        ) : null}

        {socialLinks.length > 0 ? (
          <Reveal>
            <section className="flex flex-col gap-4">
              <SectionLabel>{orDefault(social.heading, 'Follow us')}</SectionLabel>
              <SocialButtons slug={slug} socialLinks={socialLinks} />
            </section>
          </Reveal>
        ) : null}

        {contact.heading || about.phone || slug ? (
          <Reveal>
            <section className="flex flex-col items-center gap-4 bg-[#141416] p-6 text-center">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
                {orDefault(contact.heading, 'Get in touch')}
              </h2>
              {about.phone ? <p className="text-sm text-gray-300">{about.phone}</p> : null}
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

      <footer className="flex flex-col items-center gap-2 border-t-2 bg-[#141416] py-6 text-center text-xs text-gray-500" style={{ borderColor: ACCENT }}>
        <ShareButton businessName={businessName} />
        <LoyaltyCardLink slug={slug} active={loyaltyActive} />
        <span>{orDefault(footer.text, `© ${businessName}`)}</span>
        {!hideBranding ? <span>Powered by QRHub</span> : null}
      </footer>
    </div>
  );
}

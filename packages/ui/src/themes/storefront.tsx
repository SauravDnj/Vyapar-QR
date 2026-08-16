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

const ACCENT = 'var(--theme-accent,#000000)';

/** Retail-category theme: punchy, grid-driven, price-tag-style badges. */
export function StorefrontTheme({
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
    <div className="mx-auto flex max-w-md flex-col gap-10 bg-white px-6 py-14 text-gray-900" style={accentColorStyle(accentColor)}>
      <Reveal>
        <header
          className={`flex items-center gap-4 border-b-4 border-black pb-6 ${hero.backgroundImageUrl ? 'relative overflow-hidden px-6 pt-6 text-white' : ''}`}
          style={
            hero.backgroundImageUrl
              ? { backgroundImage: `url(${hero.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {hero.backgroundImageUrl ? <div className="absolute inset-0 bg-black/45" /> : null}
          <div className={hero.backgroundImageUrl ? 'relative z-10 flex items-center gap-4' : 'contents'}>
            {hero.logoUrl ? (
              <img src={hero.logoUrl} alt={businessName} className="h-14 w-14 flex-none rounded object-cover" />
            ) : null}
            <div>
              <h1 className="text-2xl font-extrabold">{orDefault(hero.headline, businessName)}</h1>
              {hero.tagline ? (
                <p className={hero.backgroundImageUrl ? 'text-sm text-white/80' : 'text-sm text-gray-500'}>{hero.tagline}</p>
              ) : null}
            </div>
          </div>
        </header>
      </Reveal>

      {about.description || about.address || about.hours || about.phone ? (
        <Reveal>
          <section className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            {about.description ? <p className="col-span-2">{about.description}</p> : null}
            {about.address ? <p>{about.address}</p> : null}
            {about.hours ? <p>{about.hours}</p> : null}
            {about.phone ? <p>{about.phone}</p> : null}
          </section>
        </Reveal>
      ) : null}

      {menu.fileUrl ? (
        <Reveal>
          <section className="flex flex-col gap-4">
            <h2 className="inline-block w-fit px-2 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: ACCENT }}>{orDefault(menu.heading, 'Menu')}</h2>
            <DocumentViewer url={menu.fileUrl} label={orDefault(menu.heading, 'Menu')} />
          </section>
        </Reveal>
      ) : null}

      {galleryImages.length > 0 ? (
        <Reveal>
          <section className="flex flex-col gap-4">
            <h2 className="inline-block w-fit px-2 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: ACCENT }}>Gallery</h2>
            <GalleryGrid images={galleryImages} />
          </section>
        </Reveal>
      ) : null}

      {locations.length > 0 ? (
        <Reveal>
          <section className="flex flex-col gap-4">
            <h2 className="inline-block w-fit px-2 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: ACCENT }}>
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
            <h2 className="inline-block w-fit px-2 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: ACCENT }}>
              {orDefault(payment.heading, 'Pay us')}
            </h2>
            <PaymentButtons slug={slug} businessName={businessName} paymentMethods={paymentMethods} />
          </section>
        </Reveal>
      ) : null}

      {reviewConfig?.reviewLink || slug ? (
        <Reveal>
          <section className="flex flex-col items-center gap-4 border-2 border-black p-6 text-center">
            <h2 className="inline-block w-fit px-2 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: ACCENT }}>
              {orDefault(reviewsCopy.heading, 'Rate us')}
            </h2>
            {reviewConfig?.avgRatingCached ? <p className="text-2xl font-extrabold">★ {reviewConfig.avgRatingCached}</p> : null}
            <ReviewsDisplay reviews={reviews} />
            <ReviewFunnel slug={slug} />
          </section>
        </Reveal>
      ) : null}

      {testimonials.length > 0 || slug ? (
        <Reveal>
          <section className="flex flex-col items-center gap-4 border-2 border-black p-6 text-center">
            <h2 className="inline-block w-fit px-2 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: ACCENT }}>
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
            <h2 className="inline-block w-fit px-2 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: ACCENT }}>
              {orDefault(social.heading, 'Follow us')}
            </h2>
            <SocialButtons slug={slug} socialLinks={socialLinks} />
          </section>
        </Reveal>
      ) : null}

      {contact.heading || about.phone || slug ? (
        <Reveal>
          <section className="flex flex-col items-center gap-4 text-center text-sm text-gray-600">
            <h2 className="inline-block w-fit px-2 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: ACCENT }}>
              {orDefault(contact.heading, 'Get in touch')}
            </h2>
            {about.phone ? <p>{about.phone}</p> : null}
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

      <footer className="flex flex-col items-center gap-2 border-t-4 border-black pt-4 text-center text-xs text-gray-400">
        <ShareButton businessName={businessName} />
        <LoyaltyCardLink slug={slug} active={loyaltyActive} />
        <span>{orDefault(footer.text, `© ${businessName}`)}</span>
        {!hideBranding ? <span>Powered by QRHub</span> : null}
      </footer>
    </div>
  );
}

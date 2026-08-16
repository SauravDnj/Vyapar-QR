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

/** Academy's default accent is a friendly, energetic indigo-500 — the
 * "modern learning platform" color that reads encouraging rather than
 * stuffy-academic, while still letting a client's chosen accent override it. */
const ACCENT = 'var(--theme-accent,#6366f1)';

export function AcademyTheme({
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

  const aboutItems = [
    about.description ? { label: 'About', value: about.description } : null,
    about.address ? { label: 'Where', value: about.address } : null,
    about.hours ? { label: 'Hours', value: about.hours } : null,
    about.phone ? { label: 'Call', value: about.phone } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <div
      className="mx-auto flex max-w-md flex-col gap-12 bg-[#f5f6ff] pb-16 text-slate-900"
      style={accentColorStyle(accentColor)}
    >
      <Reveal>
        <header
          className={`flex flex-col items-center gap-4 px-6 pb-10 pt-16 text-center ${
            hero.backgroundImageUrl ? 'relative overflow-hidden text-white' : 'bg-white'
          }`}
          style={
            hero.backgroundImageUrl
              ? { backgroundImage: `url(${hero.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {hero.backgroundImageUrl ? <div className="absolute inset-0 bg-black/45" /> : null}
          <div className={hero.backgroundImageUrl ? 'relative z-10 flex flex-col items-center gap-4' : 'contents'}>
            {hero.logoUrl ? (
              <img src={hero.logoUrl} alt={businessName} className="h-20 w-20 rounded-full object-cover shadow-sm" />
            ) : null}
            {hero.tagline ? (
              <span
                className="rounded-full px-4 py-1 text-xs font-bold tracking-wide text-white"
                style={{ backgroundColor: ACCENT }}
              >
                {hero.tagline}
              </span>
            ) : null}
            <h1 className="text-3xl font-bold tracking-tight">{orDefault(hero.headline, businessName)}</h1>
          </div>
        </header>
      </Reveal>

      {aboutItems.length > 0 ? (
        <Reveal>
          <section className="mx-6 flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold">Get to know us</h2>
            <ol className="flex flex-col gap-3">
              {aboutItems.map((item) => (
                <li key={item.label} className="flex items-start gap-3 text-sm text-slate-600">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {item.label.charAt(0)}
                  </span>
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</span>
                    {item.value}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>
      ) : null}

      {menu.fileUrl ? (
        <Reveal>
          <section className="mx-6 flex flex-col gap-4">
            <h2 className="text-center text-lg font-bold">{orDefault(menu.heading, 'Courses & Fees')}</h2>
            <DocumentViewer url={menu.fileUrl} label={orDefault(menu.heading, 'Courses & Fees')} />
          </section>
        </Reveal>
      ) : null}

      {galleryImages.length > 0 ? (
        <Reveal>
          <section className="mx-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-center text-lg font-bold">Gallery</h2>
            <GalleryGrid images={galleryImages} />
          </section>
        </Reveal>
      ) : null}

      {locations.length > 0 ? (
        <Reveal>
          <section className="mx-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-center text-lg font-bold">{orDefault(locationsCopy.heading, 'Our locations')}</h2>
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
          <section className="mx-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-center text-lg font-bold">{orDefault(payment.heading, 'Pay us')}</h2>
            <PaymentButtons slug={slug} businessName={businessName} paymentMethods={paymentMethods} />
          </section>
        </Reveal>
      ) : null}

      {reviewConfig?.reviewLink || slug ? (
        <Reveal>
          <section
            className="mx-6 flex flex-col items-center gap-4 rounded-3xl p-6 text-center text-white"
            style={{ backgroundColor: ACCENT }}
          >
            <h2 className="text-lg font-bold">{orDefault(reviewsCopy.heading, 'Rate us')}</h2>
            {reviewConfig?.avgRatingCached ? (
              <p className="rounded-full bg-white/20 px-4 py-1 text-lg font-bold">★ {reviewConfig.avgRatingCached}</p>
            ) : null}
            <ReviewsDisplay reviews={reviews} />
            <ReviewFunnel slug={slug} />
          </section>
        </Reveal>
      ) : null}

      {testimonials.length > 0 || slug ? (
        <Reveal>
          <section className="mx-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-center text-lg font-bold">{orDefault(testimonialsCopy.heading, 'What people say')}</h2>
            <TestimonialsWall testimonials={testimonials} />
            <TestimonialForm slug={slug} />
          </section>
        </Reveal>
      ) : null}

      {socialLinks.length > 0 ? (
        <Reveal>
          <section className="mx-6 flex flex-col items-center gap-3 text-center">
            <h2 className="text-lg font-bold">{orDefault(social.heading, 'Follow us')}</h2>
            <SocialButtons slug={slug} socialLinks={socialLinks} />
          </section>
        </Reveal>
      ) : null}

      {contact.heading || about.phone || slug ? (
        <Reveal>
          <section className="mx-6 flex flex-col items-center gap-4 rounded-3xl bg-white p-6 text-center shadow-sm">
            <h2 className="text-lg font-bold">{orDefault(contact.heading, 'Get in touch')}</h2>
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

      <footer className="flex flex-col items-center gap-2 px-6 text-center text-xs text-slate-400">
        <ShareButton businessName={businessName} />
        <LoyaltyCardLink slug={slug} active={loyaltyActive} />
        <span>{orDefault(footer.text, `© ${businessName}`)}</span>
        {!hideBranding ? <span>Powered by QRHub</span> : null}
      </footer>
    </div>
  );
}

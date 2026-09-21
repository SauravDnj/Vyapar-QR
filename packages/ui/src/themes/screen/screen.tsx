'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { BookingButton } from '../../booking-button';
import { BookingSlotsWidget } from '../../booking-slots-widget';
import { ContactForm } from '../../contact-form';
import { CouponsList } from '../../coupons-list';
import { DocumentViewer } from '../../document-viewer';
import { GalleryGrid } from '../../gallery-grid';
import { Icon } from '../../icon';
import { LocationsList } from '../../locations-list';
import { LoyaltyCardLink } from '../../loyalty-card-link';
import { MenuOrder } from '../../menu-order';
import { PaymentButtons } from '../../payment-buttons';
import { ReviewFunnel } from '../../review-funnel';
import { ReviewsDisplay } from '../../reviews-display';
import { downloadContactCard } from '../../save-contact-button';
import { SocialButtons, SocialGlyph } from '../../social-buttons';
import { TestimonialForm } from '../../testimonial-form';
import { TestimonialsWall } from '../../testimonials-wall';
import { orDefault } from '../../theme-content';

import { buildScreenModel, directionsUrl, splitDock } from './model';
import { Sheet } from './sheet';

import type { LiveSections, PanelInfo, PanelKey, QuickAction } from './model';
import type { IconName } from '../../icon';
import type { SocialPlatform, ThemeRenderProps } from '@vyaparqr/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

const SOCIAL_ICONS = new Set<string>(['whatsapp', 'instagram', 'facebook', 'linkedin', 'x', 'youtube']);

export function trackClick(slug: string | undefined, label: string) {
  if (!slug) return;
  void fetch(`${API_URL}/public/landing/${slug}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'button_click', meta: { label } }),
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Menu ordering, offers and booking slots are fetched on the client by their
 * own components. The dock needs to know up front whether each has anything,
 * so a section is never offered that opens onto an empty sheet.
 */
function useLiveSections(slug: string | undefined): LiveSections {
  const [live, setLive] = useState<LiveSections>({ order: false, offers: false, slots: false });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const hasItems = async (path: string) => {
      try {
        const response = await fetch(`${API_URL}/public/landing/${slug}/${path}`);
        if (!response.ok) return false;
        const body = (await response.json()) as unknown;
        return Array.isArray(body) && body.length > 0;
      } catch {
        return false;
      }
    };
    void Promise.all([hasItems('menu'), hasItems('coupons'), hasItems('booking-slots')]).then(([order, offers, slots]) => {
      if (!cancelled) setLive({ order, offers, slots });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return live;
}

/** The state every single-screen theme runs on: the model plus the open sheet. */
export function useScreen(props: ThemeRenderProps) {
  const live = useLiveSections(props.slug);
  const model = useMemo(() => buildScreenModel(props, live), [props, live]);
  const { dock, overflow } = useMemo(() => splitDock(model.panels), [model.panels]);
  const [panel, setPanel] = useState<PanelKey | null>(null);

  const open = useCallback(
    (key: PanelKey) => {
      trackClick(props.slug, `sheet:${key}`);
      setPanel(key);
    },
    [props.slug],
  );
  const close = useCallback(() => {
    setPanel(null);
  }, []);

  const saveContact = useCallback(() => {
    trackClick(props.slug, 'save_contact');
    downloadContactCard(props.businessName, model.phone, model.address);
  }, [props.slug, props.businessName, model.phone, model.address]);

  const share = useCallback(async () => {
    trackClick(props.slug, 'share');
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: props.businessName, url });
      } catch {
        // Cancelling the share sheet is not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked; nothing useful to show.
    }
  }, [props.slug, props.businessName]);

  return { model, dock, overflow, panel, open, close, saveContact, share };
}

export type Screen = ReturnType<typeof useScreen>;

/** An icon from the theme set, or a social platform's glyph. */
export function ActionIcon({ icon, className }: { icon: IconName | SocialPlatform; className?: string }) {
  if (SOCIAL_ICONS.has(icon)) {
    return <SocialGlyph platform={icon as SocialPlatform} className={className} />;
  }
  return <Icon name={icon as IconName} className={className} />;
}

/**
 * Renders one quick action as whatever element it needs to be — a link, a
 * sheet opener, or the review funnel's trigger — with the theme supplying
 * the visuals through `children`.
 */
export function ScreenAction({
  action,
  screen,
  slug,
  businessName,
  className,
  style,
  children,
}: {
  action: QuickAction;
  screen: Screen;
  slug?: string;
  businessName: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (action.kind === 'link') {
    return (
      <a
        href={action.href}
        target={action.external ? '_blank' : undefined}
        rel={action.external ? 'noopener noreferrer' : undefined}
        onClick={() => {
          trackClick(slug, action.id);
        }}
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }

  if (action.kind === 'panel') {
    return (
      <button
        type="button"
        onClick={() => {
          screen.open(action.panel);
        }}
        className={className}
        style={style}
      >
        {children}
      </button>
    );
  }

  return (
    <ReviewFunnel
      slug={slug}
      businessName={businessName}
      renderTrigger={(openReview) => (
        <button
          type="button"
          onClick={() => {
            trackClick(slug, 'review');
            openReview();
          }}
          className={className}
          style={style}
        >
          {children}
        </button>
      )}
    />
  );
}

export function actionIcon(action: QuickAction): IconName | SocialPlatform {
  return action.kind === 'review' ? 'star' : action.icon;
}

const PANEL_TITLES: Partial<Record<PanelKey, string>> = {
  pay: 'Pay',
  about: 'About',
  order: 'Order online',
  gallery: 'Gallery',
  locations: 'Our branches',
  offers: 'Offers',
  book: 'Book a time',
  reviews: 'What people say',
  loyalty: 'Rewards',
  enquire: 'Send an enquiry',
  follow: 'Follow us',
  more: 'More',
};

/** The sheet, with the body for whichever section is open. */
export function ScreenSheet({ screen, props }: { screen: Screen; props: ThemeRenderProps }) {
  const { panel } = screen;
  const title =
    panel === 'menu' ? orDefault(props.content.menu?.heading, 'Menu') : panel ? (PANEL_TITLES[panel] ?? '') : '';

  return (
    <Sheet open={panel !== null} title={title} onClose={screen.close}>
      {panel ? <PanelBody panel={panel} screen={screen} props={props} /> : null}
    </Sheet>
  );
}

function PanelBody({ panel, screen, props }: { panel: PanelKey; screen: Screen; props: ThemeRenderProps }) {
  const { slug, businessName, content } = props;
  const about = content.about ?? {};

  switch (panel) {
    case 'pay':
      return <PaymentButtons slug={slug} businessName={businessName} paymentMethods={props.paymentMethods} />;

    case 'about':
      return (
        <div className="flex flex-col gap-5">
          {about.description ? (
            <p className="text-[15px] leading-relaxed whitespace-pre-line">{about.description}</p>
          ) : null}
          <div className="flex flex-col gap-1">
            {about.hours ? <DetailRow icon="clock" label="Hours" value={about.hours} /> : null}
            {about.phone ? (
              <DetailRow icon="phone" label="Phone" value={about.phone} href={`tel:${about.phone.replace(/\s+/g, '')}`} />
            ) : null}
            {about.address ? (
              <DetailRow icon="map-pin" label="Address" value={about.address} href={directionsUrl(about.address)} external />
            ) : null}
          </div>
          {content.footer?.text ? <p className="qs-muted text-sm">{content.footer.text}</p> : null}
        </div>
      );

    case 'menu':
      return content.menu?.fileUrl ? (
        <DocumentViewer url={content.menu.fileUrl} label={orDefault(content.menu.heading, 'Menu')} />
      ) : null;

    case 'order':
      return <MenuOrder slug={slug} />;

    case 'gallery':
      return <GalleryGrid images={props.galleryImages ?? []} />;

    case 'locations':
      return <LocationsList locations={props.locations ?? []} />;

    case 'offers':
      return <CouponsList slug={slug} />;

    case 'book':
      return (
        <div className="flex flex-col items-stretch gap-4">
          {content.contact?.bookingUrl ? (
            <BookingButton
              url={content.contact.bookingUrl}
              slug={slug}
              accentStyle={{ backgroundColor: 'var(--t-accent)', color: 'var(--t-accent-text)' }}
            />
          ) : null}
          <div className="flex justify-center">
            <BookingSlotsWidget slug={slug} />
          </div>
        </div>
      );

    case 'reviews':
      return (
        <div className="flex flex-col gap-4">
          <ReviewsDisplay reviews={props.reviews ?? []} />
          <TestimonialsWall testimonials={props.testimonials ?? []} />
          {slug ? (
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-sm font-semibold">Share your experience</p>
              <TestimonialForm slug={slug} />
            </div>
          ) : null}
        </div>
      );

    case 'loyalty':
      return (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Icon name="gift" className="size-10" style={{ color: 'var(--t-accent)' }} />
          <p className="text-[15px]">Collect a stamp on every visit and unlock rewards.</p>
          <LoyaltyCardLink slug={slug} active={props.loyaltyActive} />
        </div>
      );

    case 'enquire':
      return <ContactForm slug={slug} />;

    case 'follow':
      return (
        <div className="py-2">
          <SocialButtons slug={slug} socialLinks={props.socialLinks} />
        </div>
      );

    case 'more':
      return <MoreGrid screen={screen} />;
  }
}

function MoreGrid({ screen }: { screen: Screen }) {
  const items: { key: string; label: string; icon: IconName; onClick: () => void }[] = [
    ...screen.overflow.map((info: PanelInfo) => ({
      key: info.key,
      label: info.label,
      icon: info.icon,
      onClick: () => {
        screen.open(info.key);
      },
    })),
    { key: 'save', label: 'Save contact', icon: 'user-plus', onClick: screen.saveContact },
    {
      key: 'share',
      label: 'Share',
      icon: 'share',
      onClick: () => {
        void screen.share();
      },
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 pb-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          className="qs-more-tile flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center text-[13px] font-medium transition-transform active:scale-95"
        >
          <Icon name={item.icon} className="size-6" style={{ color: 'var(--t-accent)' }} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: IconName;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <span className="qs-detail-icon flex size-10 shrink-0 items-center justify-center rounded-full">
        <Icon name={icon} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="qs-muted block text-xs font-medium tracking-wide uppercase">{label}</span>
        <span className="block text-[15px] leading-snug">{value}</span>
      </span>
      {href ? <Icon name="chevron-right" className="qs-muted size-4 shrink-0" /> : null}
    </>
  );

  return href ? (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex min-h-14 items-center gap-3 rounded-xl py-2 transition-opacity active:opacity-70"
    >
      {body}
    </a>
  ) : (
    <div className="flex min-h-14 items-center gap-3 py-2">{body}</div>
  );
}

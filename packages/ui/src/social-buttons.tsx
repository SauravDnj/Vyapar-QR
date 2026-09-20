'use client';

import { PlatformLogo } from './brand-logos';

import type { PublicSocialLink, SocialPlatform } from '@vyaparqr/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export const SOCIAL_LABEL: Record<SocialPlatform, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'X',
  youtube: 'YouTube',
};

const LABEL = SOCIAL_LABEL;

/**
 * The platform's own mark, for themes that draw their own buttons.
 *
 * These used to be simplified outline shapes drawn here, on the reasoning
 * that the official logos are trademarked graphics. That got the trade-off
 * backwards: each platform publishes its mark so that a link going to it can
 * be labelled, and a customer recognises the green WhatsApp bubble instantly
 * where a generic chat outline means nothing. The real marks now live in
 * `brand-logos.tsx`.
 */
export function SocialGlyph({ platform, className = 'h-4 w-4' }: { platform: SocialPlatform; className?: string }) {
  return <PlatformLogo brand={platform} className={className} />;
}

/** Where tapping a social link goes — a chat for WhatsApp, the profile otherwise. */
export function socialHref(link: PublicSocialLink): string {
  const raw = link.value.trim();
  /* A client types whatever they have to hand: a full profile URL, an @handle,
     or a bare username. Anything that already looks like a URL is used as-is;
     the rest is hung off the platform's own domain. This is why links added in
     the admin could look right and still go nowhere. */
  const handle = raw.replace(/^@/, '');
  const isUrl = /^https?:\/\//i.test(raw);
  /* Values saved before the API stopped rewriting them can carry a bare
     http://, which costs every visitor an insecure hop and a redirect. Every
     platform here serves https. */
  const url = raw.replace(/^http:\/\//i, 'https://');

  switch (link.platform) {
    case 'whatsapp':
      return isUrl ? url : `https://wa.me/${raw.replace(/\D/g, '')}`;
    case 'instagram':
      return isUrl ? url : `https://instagram.com/${handle}`;
    case 'facebook':
      return isUrl ? url : `https://facebook.com/${handle}`;
    case 'linkedin':
      /* A LinkedIn handle alone is ambiguous between /in/ and /company/, so a
         bare value is treated as a person unless it says otherwise. */
      return isUrl ? url : `https://www.linkedin.com/in/${handle}`;
    case 'x':
      return isUrl ? url : `https://x.com/${handle}`;
    case 'youtube':
      if (isUrl) return url;
      return handle.startsWith('UC')
        ? `https://www.youtube.com/channel/${handle}`
        : `https://www.youtube.com/@${handle}`;
  }
}

function trackClick(slug: string | undefined, label: string) {
  if (!slug) return;
  void fetch(`${API_URL}/public/landing/${slug}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'button_click', meta: { label } }),
    keepalive: true,
  });
}

export function SocialButtons({ slug, socialLinks }: { slug?: string; socialLinks: PublicSocialLink[] }) {
  const links = [...socialLinks].sort((a, b) => a.displayOrder - b.displayOrder);
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {links.map((link) => (
        <a
          key={link.id}
          href={socialHref(link)}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            trackClick(slug, link.platform);
          }}
          className="flex min-h-11 items-center gap-2.5 rounded-full border px-5 py-2 text-sm font-medium shadow-sm transition-transform active:scale-95"
          style={{ borderColor: 'var(--t-border, #e5e7eb)', color: 'var(--t-text, #1c1917)' }}
        >
          <SocialGlyph platform={link.platform} className="h-5 w-5 shrink-0" />
          {LABEL[link.platform]}
        </a>
      ))}
    </div>
  );
}

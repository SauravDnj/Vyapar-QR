'use client';

import { PlatformLogo } from './brand-logos';

import type { PublicSocialLink, SocialPlatform } from '@vyaparqr/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

const LABEL: Record<SocialPlatform, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

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
  switch (link.platform) {
    case 'whatsapp':
      return `https://wa.me/${link.value.replace(/\D/g, '')}`;
    case 'instagram':
      return link.value.startsWith('http') ? link.value : `https://instagram.com/${link.value.replace(/^@/, '')}`;
    case 'facebook':
      return link.value.startsWith('http') ? link.value : `https://facebook.com/${link.value}`;
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

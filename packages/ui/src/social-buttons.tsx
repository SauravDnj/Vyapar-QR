'use client';

import type { PublicSocialLink, SocialPlatform } from '@qrhub/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

const LABEL: Record<SocialPlatform, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

/** Brand-colored fill per platform, from the shared design tokens (see
 * globals.css in both apps/admin and apps/landing — packages/ui components
 * render in both, so the tokens have to exist in both). Real platform
 * colors, not a generic gray button, per the "fix the WhatsApp/Facebook/
 * Instagram colors" request — but simple geometric glyphs below rather
 * than the official logos, which are trademarked graphics. */
const STYLE: Record<SocialPlatform, string> = {
  whatsapp: 'bg-whatsapp hover:bg-whatsapp-hover',
  facebook: 'bg-facebook hover:bg-facebook-hover',
  instagram: 'bg-instagram hover:bg-instagram-hover',
};

function Icon({ platform }: { platform: SocialPlatform }) {
  const common = { className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 } as const;
  switch (platform) {
    case 'whatsapp':
      return (
        <svg {...common} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 17.5 5 20l2.6-1.4A8 8 0 1 0 5 12a8 8 0 0 0 1.5 4.7Z" />
          <path d="M9.5 9.8c0-.7.6-1.3 1.2-1.3.3 0 .6.2.8.5l.6 1.1c.2.3.1.7-.1.9l-.5.5c.4 1 1.2 1.8 2.2 2.2l.5-.5c.2-.2.6-.3.9-.1l1.1.6c.3.2.5.5.5.8 0 .6-.6 1.2-1.3 1.2-2.9 0-5.9-3-5.9-5.9Z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg {...common} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 21v-7h2.5l.5-3H14V9c0-.9.3-1.5 1.6-1.5H17V5.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.7 1.4-3.7 3.9V11H8.5v3H11v7Z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...common} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="4.5" />
          <circle cx="12" cy="12" r="3.2" />
          <circle cx="16.3" cy="7.7" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function hrefFor(link: PublicSocialLink): string {
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
          href={hrefFor(link)}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            trackClick(slug, link.platform);
          }}
          className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white shadow-sm transition ${STYLE[link.platform]}`}
        >
          <Icon platform={link.platform} />
          {LABEL[link.platform]}
        </a>
      ))}
    </div>
  );
}

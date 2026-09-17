import { ThemeRenderer } from '@vyaparqr/ui';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { LanguageSwitcher } from './language-switcher';
import { PageViewTracker } from './page-view-tracker';
import { PwaInstall } from './pwa-install';
import { ScanTracker } from './scan-tracker';

import type {
  PublicGalleryImage,
  PublicLocation,
  PublicPaymentMethod,
  PublicReviewItem,
  PublicSocialLink,
  PublicTestimonial,
  SeoMeta,
} from '@vyaparqr/types';
import type { Metadata, Viewport } from 'next';

export const revalidate = 300;

/** `viewport-fit=cover` lets the themes run edge to edge and pad themselves
 * with `env(safe-area-inset-*)` around the notch and home indicator. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

type PublicLandingPageResponse =
  | { status: 'suspended'; businessName: string }
  | {
      status: 'published';
      businessName: string;
      themeName: string;
      seoMeta: SeoMeta | null;
      content: Record<string, Record<string, string>>;
      paymentMethods: PublicPaymentMethod[];
      socialLinks: PublicSocialLink[];
      reviewConfig: { reviewLink: string | null; avgRatingCached: string | null } | null;
      reviews: PublicReviewItem[];
      hideBranding: boolean;
      availableLocales: string[];
      activeLocale: string | null;
      accentColor: string | null;
      galleryImages: PublicGalleryImage[];
      locations: PublicLocation[];
      testimonials: PublicTestimonial[];
      loyaltyActive: boolean;
    };

async function fetchLandingPage(slug: string, lang?: string): Promise<PublicLandingPageResponse | null> {
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';
  const response = await fetch(`${API_URL}/public/landing/${slug}${query}`, { next: { revalidate } });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load landing page: ${String(response.status)}`);
  }
  return (await response.json()) as PublicLandingPageResponse;
}

export async function generateMetadata({ params }: PageProps<'/site/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchLandingPage(slug);
  if (!page || page.status !== 'published') {
    return { title: 'Vyapar QR' };
  }
  return {
    title: page.seoMeta?.title || page.businessName,
    description: page.seoMeta?.description,
    openGraph: page.seoMeta?.ogImage ? { images: [page.seoMeta.ogImage] } : undefined,
    manifest: `/site/${slug}/manifest.webmanifest`,
  };
}

export default async function SitePage({ params, searchParams }: PageProps<'/site/[slug]'>) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const page = await fetchLandingPage(slug, typeof lang === 'string' ? lang : undefined);

  if (!page) {
    notFound();
  }

  if (page.status === 'suspended') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-xl font-semibold">{page.businessName}</h1>
        <p className="text-gray-500">This page is temporarily unavailable.</p>
      </main>
    );
  }

  // Every theme is a single phone screen. On a phone the stage is the whole
  // viewport; on a wider screen it becomes a phone-sized device in the middle,
  // so a business checking its page on a laptop sees what customers see.
  return (
    <main className="qr-stage">
      <Suspense fallback={null}>
        <ScanTracker slug={slug} />
      </Suspense>
      <PageViewTracker slug={slug} />
      <div className="qr-device">
        <Suspense fallback={null}>
          <LanguageSwitcher locales={page.availableLocales} />
        </Suspense>
        <div className="qr-screen">
          <ThemeRenderer
            themeName={page.themeName}
            slug={slug}
            businessName={page.businessName}
            content={page.content}
            paymentMethods={page.paymentMethods}
            socialLinks={page.socialLinks}
            reviewConfig={page.reviewConfig}
            reviews={page.reviews}
            hideBranding={page.hideBranding}
            accentColor={page.accentColor}
            galleryImages={page.galleryImages}
            locations={page.locations}
            testimonials={page.testimonials}
            loyaltyActive={page.loyaltyActive}
          />
        </div>
      </div>
      <PwaInstall businessName={page.businessName} />
    </main>
  );
}

import { ThemeRenderer } from '@qrhub/ui';
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
} from '@qrhub/types';
import type { Metadata } from 'next';

export const revalidate = 300;

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
    return { title: 'QRHub' };
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

  return (
    <>
      <Suspense fallback={null}>
        <ScanTracker slug={slug} />
      </Suspense>
      <PageViewTracker slug={slug} />
      <Suspense fallback={null}>
        <LanguageSwitcher locales={page.availableLocales} />
      </Suspense>
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
      <PwaInstall businessName={page.businessName} />
    </>
  );
}

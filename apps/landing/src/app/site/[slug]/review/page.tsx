import { ReviewFunnel } from '@vyaparqr/ui';
import { notFound } from 'next/navigation';

import type { Metadata, Viewport } from 'next';

export const revalidate = 300;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

interface ReviewPageData {
  businessName: string;
  logoUrl: string;
  accentColor: string | null;
}

/**
 * The page behind the review link a business sends out.
 *
 * Separate from the landing page on purpose: a "please review us" WhatsApp
 * message should land on the rating stars, not on a business card the
 * customer has to read first. The writer opens immediately, and the whole
 * flow is the same component the landing page uses, so there is one review
 * funnel to maintain rather than two.
 */
async function fetchPage(slug: string): Promise<ReviewPageData | null> {
  const response = await fetch(`${API_URL}/public/landing/${slug}`, { next: { revalidate } });
  if (!response.ok) {
    return null;
  }
  const page = (await response.json()) as {
    status: string;
    businessName: string;
    content?: Record<string, Record<string, string>>;
    accentColor?: string | null;
  };
  if (page.status !== 'published') {
    return null;
  }
  return {
    businessName: page.businessName,
    logoUrl: page.content?.hero?.logoUrl ?? '',
    accentColor: page.accentColor ?? null,
  };
}

export async function generateMetadata({ params }: PageProps<'/site/[slug]/review'>): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPage(slug);
  return {
    title: page ? `Review ${page.businessName}` : 'Leave a review',
    description: page ? `Tell others about your experience at ${page.businessName}.` : undefined,
    // A review link is shared, not searched for, and it duplicates the
    // landing page's content.
    robots: { index: false, follow: true },
  };
}

export default async function ReviewPage({ params }: PageProps<'/site/[slug]/review'>) {
  const { slug } = await params;
  const page = await fetchPage(slug);

  if (!page) {
    notFound();
  }

  const accent = page.accentColor ?? '#1a73e8';

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#f8f9fa] px-6 py-10 text-center">
      <div className="flex flex-col items-center gap-3">
        {page.logoUrl ? (
          <img src={page.logoUrl} alt="" className="size-20 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-20 items-center justify-center rounded-full text-2xl font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            {page.businessName.slice(0, 2).toUpperCase()}
          </span>
        )}
        <h1 className="text-2xl font-semibold text-[#202124]">{page.businessName}</h1>
        <p className="max-w-xs text-sm text-[#5f6368]">
          How was your experience? It takes a few seconds — and we can help you write it.
        </p>
      </div>

      <ReviewFunnel slug={slug} businessName={page.businessName} autoOpen />

      <a href={`/site/${slug}`} className="text-xs text-[#5f6368] underline">
        Visit {page.businessName}
      </a>
    </main>
  );
}

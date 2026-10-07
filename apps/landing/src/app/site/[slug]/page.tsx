import { SiteView, siteMetadata, siteViewport } from './site-view';

import type { Metadata } from 'next';

// Literal, because Next reads segment config statically. Kept in step with
// REVALIDATE_SECONDS in `site-view.tsx`.
export const revalidate = 300;

/** An empty list makes every client page ISR: built on its first visit, then
 * served from the edge cache. Without `generateStaticParams` at all, Next
 * renders this route on every request. */
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export const viewport = siteViewport;

export async function generateMetadata({ params }: PageProps<'/site/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  return siteMetadata(slug);
}

export default async function SitePage({ params }: PageProps<'/site/[slug]'>) {
  const { slug } = await params;
  return <SiteView slug={slug} />;
}

import { SiteView, siteMetadata, siteViewport } from '../../site-view';

import type { Metadata } from 'next';

/**
 * A translated client page. Visitors never type this path: the middleware
 * rewrites `/site/<slug>?lang=<lang>` here, so each language gets its own
 * cached copy instead of the page reading `searchParams` and losing ISR.
 */
export const revalidate = 300;

export function generateStaticParams(): { lang: string }[] {
  return [];
}

export const viewport = siteViewport;

export async function generateMetadata({ params }: PageProps<'/site/[slug]/lang/[lang]'>): Promise<Metadata> {
  const { slug, lang } = await params;
  return siteMetadata(slug, lang);
}

export default async function SiteLanguagePage({ params }: PageProps<'/site/[slug]/lang/[lang]'>) {
  const { slug, lang } = await params;
  return <SiteView slug={slug} lang={lang} />;
}

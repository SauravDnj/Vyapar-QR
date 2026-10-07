import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

/**
 * Hosts that should render normally via `/site/[slug]`. Everything else is
 * treated as a possible client custom domain (P3-01) and looked up.
 *
 * `NEXT_PUBLIC_PLATFORM_HOST` is what makes this work once the platform has a
 * real domain of its own: without it, that domain would fall through to the
 * custom-domain lookup, find no client, and serve the wrong thing. Preview
 * deploys are covered by the `.vercel.app` check.
 *
 * It takes a comma-separated list, because moving to a new domain means
 * serving the old one and the new one at the same time for a while.
 */
const PLATFORM_HOSTS = new Set(
  [
    'localhost:3002',
    '127.0.0.1:3002',
    ...(process.env.NEXT_PUBLIC_PLATFORM_HOST ?? '').split(','),
  ]
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0),
);

/** `/site/<slug>` exactly — not its review, loyalty or manifest children. */
const SITE_ROOT = /^\/site\/([^/]+)\/?$/;
const LANG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

/**
 * Custom-domain lookups, remembered per edge instance. Every scan on a client's
 * own domain used to wait on an uncached API call before the page could even
 * start; a domain's slug practically never changes, so five minutes is safe.
 * Misses are remembered too, briefly, so stray hosts don't hammer the API.
 */
const DOMAIN_TTL_MS = 5 * 60 * 1000;
const MISS_TTL_MS = 60 * 1000;
const domainCache = new Map<string, { slug: string | null; expires: number }>();

async function slugForDomain(hostname: string): Promise<string | null> {
  const cached = domainCache.get(hostname);
  if (cached && cached.expires > Date.now()) {
    return cached.slug;
  }
  try {
    const response = await fetch(`${API_URL}/public/domains/${encodeURIComponent(hostname)}`);
    const slug = response.ok ? ((await response.json()) as { slug: string }).slug : null;
    domainCache.set(hostname, { slug, expires: Date.now() + (slug ? DOMAIN_TTL_MS : MISS_TTL_MS) });
    return slug;
  } catch {
    // API unreachable — fall through to normal routing rather than 500.
    return null;
  }
}

/**
 * The page is ISR and must not read `searchParams`, so a `?lang=` choice is
 * moved onto the path, where it gets its own cached copy. The visitor's URL is
 * unchanged — this is a rewrite, not a redirect.
 */
function rewriteToSite(request: NextRequest, slug: string): NextResponse {
  const url = request.nextUrl.clone();
  const lang = url.searchParams.get('lang');
  url.pathname = lang && LANG.test(lang) ? `/site/${slug}/lang/${lang}` : `/site/${slug}`;
  return NextResponse.rewrite(url);
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase();

  if (PLATFORM_HOSTS.has(host) || host.endsWith('.vercel.app')) {
    const match = SITE_ROOT.exec(request.nextUrl.pathname);
    if (match?.[1] && request.nextUrl.searchParams.has('lang')) {
      return rewriteToSite(request, match[1]);
    }
    return NextResponse.next();
  }

  const slug = await slugForDomain(host.split(':')[0] ?? host);
  return slug ? rewriteToSite(request, slug) : NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|icon.svg).*)'],
};

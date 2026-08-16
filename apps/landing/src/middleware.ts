import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';
/** Hosts that should render normally via `/site/[slug]` — everything else
 * is treated as a possible client custom domain (P3-01) and looked up. */
const PLATFORM_HOSTS = new Set(['localhost:3002', '127.0.0.1:3002']);

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';

  if (PLATFORM_HOSTS.has(host) || host.endsWith('.vercel.app')) {
    return NextResponse.next();
  }

  try {
    const hostname = host.split(':')[0] ?? host;
    const response = await fetch(`${API_URL}/public/domains/${encodeURIComponent(hostname)}`);
    if (response.ok) {
      const data = (await response.json()) as { slug: string };
      const url = request.nextUrl.clone();
      url.pathname = `/site/${data.slug}`;
      return NextResponse.rewrite(url);
    }
  } catch {
    // API unreachable — fall through to normal routing rather than 500.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};

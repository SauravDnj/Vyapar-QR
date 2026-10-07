import { revalidatePath } from 'next/cache';
import { after, NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { slug?: string; secret?: string } | null;

  if (!body?.secret || body.secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }
  if (!body.slug) {
    return NextResponse.json({ message: 'Missing slug' }, { status: 400 });
  }

  // Literal paths, because a `'layout'` purge of `/site/<slug>` matches nothing:
  // Next tags layouts by route pattern (`/site/[slug]`), not by real slug.
  revalidatePath(`/site/${body.slug}`);
  revalidatePath(`/site/${body.slug}/review`);
  // Which languages a client has isn't known here, so every client's
  // translated copies go. Few clients translate, and a miss just rebuilds.
  revalidatePath('/site/[slug]/lang/[lang]', 'page');

  // A purge leaves nothing cached, so the next customer to scan would wait
  // for a full rebuild. Request the page ourselves once the response is out,
  // so that rebuild has already happened by the time anyone scans.
  const pageUrl = new URL(`/site/${encodeURIComponent(body.slug)}`, request.url);
  after(async () => {
    await fetch(pageUrl, { cache: 'no-store' }).catch(() => undefined);
  });

  return NextResponse.json({ revalidated: true });
}

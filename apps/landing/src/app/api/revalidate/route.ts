import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { slug?: string; secret?: string } | null;

  if (!body?.secret || body.secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }
  if (!body.slug) {
    return NextResponse.json({ message: 'Missing slug' }, { status: 400 });
  }

  revalidatePath(`/site/${body.slug}`);
  return NextResponse.json({ revalidated: true });
}

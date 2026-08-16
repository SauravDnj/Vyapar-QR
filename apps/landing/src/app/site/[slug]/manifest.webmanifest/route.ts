const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

interface LandingPageForManifest {
  status: 'published' | 'suspended';
  businessName: string;
  accentColor?: string | null;
  content?: Record<string, Record<string, string>>;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const response = await fetch(`${API_URL}/public/landing/${slug}`, { next: { revalidate: 300 } });
  if (!response.ok) {
    return Response.json({ name: 'QRHub' }, { status: 404 });
  }

  const page = (await response.json()) as LandingPageForManifest;
  const logoUrl = page.content?.hero?.logoUrl;
  const themeColor = page.accentColor ?? '#0e7c66';

  return Response.json(
    {
      name: page.businessName,
      short_name: page.businessName,
      start_url: `/site/${slug}`,
      scope: `/site/${slug}`,
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: themeColor,
      icons: logoUrl
        ? [
            { src: logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
          ]
        : [],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}

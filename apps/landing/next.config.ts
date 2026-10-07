import { join } from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `@vyaparqr/ui` is published as TypeScript source from the workspace, so Next
  // has to compile it rather than treat it as a prebuilt dependency.
  transpilePackages: ['@vyaparqr/ui', '@vyaparqr/types'],
  // Without this, a Vercel build rooted at the app directory traces
  // dependencies from the wrong base and omits the hoisted pnpm store,
  // producing a deploy that 500s on the first workspace import.
  outputFileTracingRoot: join(__dirname, '..', '..'),
  images: {
    // Only the API's uploads go through the optimizer (see THEME_RUNTIME in
    // site-view.tsx), so only that host is allowed.
    remotePatterns: [new URL(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100'}/uploads/**`)],
    // Upload filenames are random and never reused, so a resized copy can be
    // kept for as long as Vercel allows instead of being re-made every few
    // hours, which also keeps the transformation count down.
    minimumCacheTTL: 2678400,
  },
};

export default nextConfig;

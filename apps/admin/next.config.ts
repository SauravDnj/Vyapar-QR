import { join } from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `@qrhub/ui` is published as TypeScript source from the workspace, so Next
  // has to compile it rather than treat it as a prebuilt dependency.
  transpilePackages: ['@qrhub/ui', '@qrhub/types'],
  // Without this, a Vercel build rooted at the app directory traces
  // dependencies from the wrong base and omits the hoisted pnpm store,
  // producing a deploy that 500s on the first workspace import.
  outputFileTracingRoot: join(__dirname, '..', '..'),
};

export default nextConfig;

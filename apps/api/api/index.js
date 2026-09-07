// Vercel serverless entrypoint.
//
// Deliberately plain JavaScript that requires the tsc-compiled output rather
// than importing `../src/*` directly: Vercel's Node builder bundles with
// esbuild, which does not emit the `design:paramtypes` decorator metadata
// that Nest's dependency injection relies on. `pnpm --filter api build` runs
// tsc with `emitDecoratorMetadata`, so loading from `dist/` keeps DI intact.
module.exports = require('../dist/src/vercel-handler').handler;

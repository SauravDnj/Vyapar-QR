export type BlobSdk = typeof import('@vercel/blob');

/**
 * Loads the Vercel Blob SDK lazily.
 *
 * `require` rather than `await import`: this app compiles to CommonJS, and
 * `@vercel/blob` publishes a CommonJS build, so a plain require avoids the
 * async ESM interop path entirely. Keeping it inside a function preserves the
 * laziness that matters — a local or VPS deploy that never selects the blob
 * driver never loads the SDK.
 */
export function loadBlobSdk(): BlobSdk {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@vercel/blob') as BlobSdk;
}

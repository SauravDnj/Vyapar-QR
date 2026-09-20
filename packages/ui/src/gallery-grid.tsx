import type { PublicGalleryImage } from '@vyaparqr/types';

/**
 * A responsive photo grid — each photo opens full-size in a new tab on tap
 * (same "no in-page lightbox" simplicity as `DocumentViewer`, avoids pulling
 * in a lightbox dependency for what's a QR-scanned mobile page).
 *
 * Images are visible without JavaScript. This previously used framer-motion's
 * `whileInView`, which renders each tile at `opacity: 0` until an observer
 * fires — the same pattern that left whole sections permanently invisible in
 * production. Reveal and hover are now CSS, so a photo can never be hidden by
 * a script that didn't run.
 */
export function GalleryGrid({ images }: { images: PublicGalleryImage[] }) {
  if (images.length === 0) {
    return null;
  }

  const sorted = [...images].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {sorted.map((image, index) => (
        <a
          key={image.id}
          href={image.imageUrl}
          target="_blank"
          rel="noreferrer"
          /* The tile carries a surface and a hairline of its own. A shop's
             photo is often a white studio shot or a poster on white, and on a
             light theme's sheet that lands as an invisible rectangle — the
             photo is there, it just has no edge. */
          className="qr-reveal aspect-square cursor-pointer overflow-hidden rounded-lg transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current active:scale-[0.97]"
          style={{
            animationDelay: `${String(index * 0.04)}s`,
            backgroundColor: 'color-mix(in srgb, var(--t-text, #1c1917) 5%, transparent)',
            boxShadow: 'inset 0 0 0 1px var(--t-border, #e5e7eb)',
          }}
        >
          {/* Eager, deliberately. This grid only ever renders inside a
              theme's bottom sheet, which mounts when someone taps Gallery —
              so every photo in it is wanted right now, and lazy buys nothing.
              Worse, it did not work: the sheet is inserted into an already
              laid-out subtree that has `container-type: size` (see
              `.qs-root`), and the browser's lazy-load viewport check never
              re-ran for nodes added there afterwards. The photos sat at
              naturalWidth 0 forever and the gallery looked empty. */}
          <img
            src={image.imageUrl}
            alt=""
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}

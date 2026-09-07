import type { PublicGalleryImage } from '@qrhub/types';

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
          className="qr-reveal aspect-square cursor-pointer overflow-hidden rounded-md transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current active:scale-[0.97]"
          style={{ animationDelay: `${String(index * 0.04)}s` }}
        >
          <img
            src={image.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}

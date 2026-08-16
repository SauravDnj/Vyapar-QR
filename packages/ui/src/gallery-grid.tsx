'use client';

import { motion } from 'framer-motion';

import type { PublicGalleryImage } from '@qrhub/types';

/** A responsive photo grid — each photo opens full-size in a new tab on
 * tap (same "no in-page lightbox" simplicity as `DocumentViewer`, avoids
 * pulling in a lightbox dependency for what's a QR-scanned mobile page). */
export function GalleryGrid({ images }: { images: PublicGalleryImage[] }) {
  if (images.length === 0) {
    return null;
  }

  const sorted = [...images].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {sorted.map((image, index) => (
        <motion.a
          key={image.id}
          href={image.imageUrl}
          target="_blank"
          rel="noreferrer"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: index * 0.04 }}
          className="aspect-square overflow-hidden rounded-md"
        >
          <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
        </motion.a>
      ))}
    </div>
  );
}

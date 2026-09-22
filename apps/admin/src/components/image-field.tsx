'use client';

import { useRef, useState } from 'react';

import { fileFromUrl, type CropShape } from './image-cropper';

/**
 * A logo or banner field: upload, edit, remove, and a preview drawn in exactly
 * the shape the landing page uses.
 *
 * Every way into it goes through the crop step. Picking a new file opens the
 * cropper, and so does "Edit" on the image already there — which is how an
 * image uploaded before the crop step existed, or through the onboarding form
 * that never had one, gets put right. The preview is cropped the way the page
 * crops, so an image that doesn't fit the shape looks cut off *here* too, and
 * says so, instead of only surprising the owner on the live page.
 */
export function ImageField({
  shape,
  url,
  onCrop,
  onRemove,
}: {
  shape: CropShape;
  url: string;
  /** Called with a file to crop: a newly picked one, or the current image. */
  onCrop: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [misfit, setMisfit] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Measured from a ref as well as onLoad: an image that is already cached
     finishes loading before React attaches onLoad, so the load event never
     reaches it and a wrong-shaped image went unflagged. The ref sees it
     either way. */
  function measure(img: HTMLImageElement | null) {
    if (!img?.complete || img.naturalWidth === 0) return;
    const off = Math.abs(img.naturalWidth / img.naturalHeight - shape.aspect) / shape.aspect > 0.03;
    setMisfit((prev) => (prev === off ? prev : off));
  }

  async function editCurrent() {
    setError(null);
    setLoadingEdit(true);
    try {
      onCrop(await fileFromUrl(url));
    } catch {
      setError('Couldn’t open that image for editing. Upload it again instead.');
    } finally {
      setLoadingEdit(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div>
        <p className="font-medium">{shape.label}</p>
        <p className="text-xs text-muted">{shape.hint}</p>
      </div>

      {url ? (
        <div
          className={`overflow-hidden border border-border-color bg-surface ${shape.round ? 'size-24 rounded-full' : 'w-full max-w-sm rounded-md'}`}
          style={shape.round ? undefined : { aspectRatio: `${String(shape.aspect)} / 1` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={url}
            src={url}
            alt={`${shape.label} preview`}
            className="h-full w-full object-cover"
            ref={measure}
            onLoad={(event) => {
              measure(event.currentTarget);
            }}
          />
        </div>
      ) : (
        <div
          className={`flex items-center justify-center border border-dashed border-border-color text-xs text-muted ${shape.round ? 'size-24 rounded-full' : 'w-full max-w-sm rounded-md'}`}
          style={shape.round ? undefined : { aspectRatio: `${String(shape.aspect)} / 1` }}
        >
          No image
        </div>
      )}

      {url && misfit ? (
        <p className="max-w-sm text-xs text-warning">
          This image isn’t the right shape, so part of it is cut off on your page (as above). Click <b>Edit</b> to choose
          what shows.
        </p>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onCrop(file);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="cursor-pointer rounded-md border border-border-color px-3 py-1.5 text-xs"
        >
          {url ? 'Upload new' : 'Upload'}
        </button>
        {url ? (
          <>
            <button
              type="button"
              disabled={loadingEdit}
              onClick={() => void editCurrent()}
              className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs text-accent-foreground disabled:opacity-50"
            >
              {loadingEdit ? 'Opening…' : 'Edit'}
            </button>
            <button type="button" onClick={onRemove} className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-danger">
              Remove
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

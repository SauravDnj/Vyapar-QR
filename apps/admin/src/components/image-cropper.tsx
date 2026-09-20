'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Crop, zoom and reposition an image before it is uploaded.
 *
 * Every image on a landing page is drawn into a fixed shape — the logo into a
 * circle, the background into a wide banner strip — and until now whatever the
 * client picked was sent up untouched and then cropped by CSS at render time.
 * A portrait photo became a slice of its own middle, a wide logo lost its ends,
 * and there was nothing the client could do about it from the admin because
 * they never saw the crop until they looked at the live page.
 *
 * So the crop happens here, against the same shape the theme will draw, and
 * what gets uploaded is what will be shown. That also means the upload is the
 * cropped region at a sane output size rather than the 4000px original off a
 * phone camera.
 *
 * The frame is fixed and the image moves under it: drag to reposition, the
 * slider or the wheel to zoom. The image can never be smaller than the frame,
 * so a crop can never contain empty space.
 */
export interface CropShape {
  /** width / height of the crop frame and of the exported image. */
  aspect: number;
  /** Exported width in pixels; height follows from `aspect`. */
  outputWidth: number;
  /** Circular frame — the export stays square, the theme masks it. */
  round?: boolean;
  /** PNG keeps a logo's transparency; JPEG keeps a photo's file size sane. */
  format: 'image/png' | 'image/jpeg';
}

export const LOGO_SHAPE: CropShape = { aspect: 1, outputWidth: 512, round: true, format: 'image/png' };
export const BANNER_SHAPE: CropShape = { aspect: 3, outputWidth: 1200, format: 'image/jpeg' };

const MAX_ZOOM = 4;
const FRAME_W = 288;

export function ImageCropper({
  file,
  shape,
  title,
  onCancel,
  onCropped,
}: {
  file: File;
  shape: CropShape;
  title: string;
  onCancel: () => void;
  onCropped: (cropped: File) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const frameH = Math.round(FRAME_W / shape.aspect);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    /* The cleanup revokes the URL, which makes the browser fire `error` on an
       image that was still loading — under StrictMode's double mount that is
       every first mount, and it painted "could not be read" over a picture
       that had in fact loaded fine. A discarded load says nothing about the
       file, so it says nothing to the user either. */
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setError(null);
    };
    img.onerror = () => {
      if (!cancelled) setError('That file could not be read as an image.');
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  /** Scale at which the image exactly covers the frame. Zoom multiplies it, so
   * zoom 1 is always "as small as it is allowed to get". */
  const baseScale = image ? Math.max(FRAME_W / image.naturalWidth, frameH / image.naturalHeight) : 1;
  const drawScale = baseScale * zoom;
  const dispW = image ? image.naturalWidth * drawScale : 0;
  const dispH = image ? image.naturalHeight * drawScale : 0;

  /** Keep the frame covered: the image may not be dragged past its own edge.
   * Applied while rendering rather than written back into state, so zooming
   * out cannot strand the offset outside the new bounds. */
  const clamp = (next: { x: number; y: number }) => {
    const maxX = Math.max(0, (dispW - FRAME_W) / 2);
    const maxY = Math.max(0, (dispH - frameH) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };
  const view = clamp(offset);

  function onPointerDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y };
    setDragging(true);
  }
  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    setOffset(clamp({ x: d.ox + (event.clientX - d.x), y: d.oy + (event.clientY - d.y) }));
  }
  function onPointerUp() {
    drag.current = null;
    setDragging(false);
  }

  async function handleApply() {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      const outW = shape.outputWidth;
      const outH = Math.round(outW / shape.aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable in this browser.');

      /* JPEG has no alpha, so a transparent logo would flatten onto black. */
      if (shape.format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
      }

      // The frame, expressed in the source image's own pixels.
      const sx = (dispW / 2 - FRAME_W / 2 - view.x) / drawScale;
      const sy = (dispH / 2 - frameH / 2 - view.y) / drawScale;
      const sw = FRAME_W / drawScale;
      const sh = frameH / drawScale;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, shape.format, shape.format === 'image/jpeg' ? 0.88 : undefined);
      });
      if (!blob) throw new Error('The image could not be encoded.');

      const ext = shape.format === 'image/png' ? 'png' : 'jpg';
      const base = file.name.replace(/\.[^.]+$/, '') || 'image';
      onCropped(new File([blob], `${base}-cropped.${ext}`, { type: shape.format }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The image could not be prepared.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-5 shadow-2xl">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-500">Drag to reposition, and zoom until it sits the way you want.</p>
        </div>

        <div
          className="relative mx-auto touch-none overflow-hidden bg-gray-100 select-none"
          style={{
            width: FRAME_W,
            height: frameH,
            borderRadius: shape.round ? '9999px' : '12px',
            cursor: dragging ? 'grabbing' : 'grab',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(event) => {
            setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z - event.deltaY * 0.0015)));
          }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
              style={{
                width: dispW,
                height: dispH,
                transform: `translate(calc(-50% + ${String(view.x)}px), calc(-50% + ${String(view.y)}px))`,
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-500">Loading…</div>
          )}
        </div>

        <label className="flex items-center gap-3 text-xs text-gray-600">
          <span className="w-10 shrink-0">Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => {
              setZoom(Number(event.target.value));
            }}
            className="flex-1 cursor-pointer"
            aria-label="Zoom"
          />
          <span className="w-10 shrink-0 text-right tabular-nums">{zoom.toFixed(1)}×</span>
        </label>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!image || busy}
            onClick={() => void handleApply()}
            className="cursor-pointer rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Uploading…' : 'Use this'}
          </button>
        </div>
      </div>
    </div>
  );
}

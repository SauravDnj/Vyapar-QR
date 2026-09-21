'use client';

import { BANNER_IMAGE, BANNER_OVERLAY, LOGO_IMAGE } from '@vyaparqr/types';
import { useEffect, useRef, useState } from 'react';

import type { ImageShape } from '@vyaparqr/types';

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
export interface CropShape extends ImageShape {
  /** PNG keeps a logo's transparency; JPEG keeps a photo's file size sane. */
  format: 'image/png' | 'image/jpeg';
  /** Show where the page draws the logo and buttons over this image. */
  overlay?: 'banner';
}

/* The shapes come from @vyaparqr/types, the same definition the landing page
   sizes its logo circle and banner from — so the frame here is the page's
   frame, not an approximation of it. */
export const LOGO_SHAPE: CropShape = { ...LOGO_IMAGE, format: 'image/png' };
export const BANNER_SHAPE: CropShape = { ...BANNER_IMAGE, format: 'image/jpeg', overlay: 'banner' };

/** Loads an already-uploaded image so it can be cropped again. The uploads
 * route allows the admin origin, and a blob URL keeps the canvas untainted. */
export async function fileFromUrl(url: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('That image could not be loaded.');
  const blob = await response.blob();
  return new File([blob], url.split('/').pop() ?? 'image', { type: blob.type || 'image/jpeg' });
}

const MAX_ZOOM = 4;

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

  // A wide banner gets the modal's full width; a circle doesn't need it.
  const FRAME_W = shape.round ? 248 : 320;
  const frameH = Math.round(FRAME_W / shape.aspect);
  const [showGuide, setShowGuide] = useState(true);

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
          <p className="mt-0.5 text-xs text-gray-500">
            Drag to reposition, and zoom until it sits the way you want. This is exactly the shape your page shows.
          </p>
          <p className="mt-1 text-[11px] text-gray-400">{shape.hint}</p>
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
          {image && shape.overlay === 'banner' && showGuide ? <BannerGuide width={FRAME_W} height={frameH} /> : null}
        </div>

        {shape.overlay === 'banner' ? (
          <label className="-mt-1 flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={showGuide}
              onChange={(event) => {
                setShowGuide(event.target.checked);
              }}
            />
            Show where your logo and buttons sit, and the soft edge at the bottom — keep anything important clear of them
          </label>
        ) : null}

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

/**
 * What the landing page draws on top of the banner, at the same proportions:
 * the logo circle on the bottom edge and the share / save buttons in the top
 * right. Outlines only — the owner is positioning the picture underneath.
 */
function BannerGuide({ width, height }: { width: number; height: number }) {
  const logo = BANNER_OVERLAY.logoDiameter * width;
  const button = BANNER_OVERLAY.buttonDiameter * width;
  const inset = BANNER_OVERLAY.buttonInset * width;
  const gap = BANNER_OVERLAY.buttonGap * width;
  const outline = 'absolute rounded-full border-2 border-dashed border-white/90 bg-white/35 shadow-[0_0_0_1px_rgb(0_0_0/0.25)]';
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {/* The band the page softens into a blur. */}
      <span
        className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-white/80"
        style={{ height: height * (1 - BANNER_OVERLAY.fadeFrom) }}
      />
      <span
        className={`${outline} flex justify-center text-[9px] font-semibold text-gray-800`}
        // The label sits in the visible top half: the circle's centre is on the
        // banner's bottom edge, so a centred label was cut in two.
        style={{ width: logo, height: logo, left: (width - logo) / 2, top: height - logo / 2, paddingTop: logo * 0.16 }}
      >
        Logo
      </span>
      {[0, 1].map((i) => (
        <span key={i} className={outline} style={{ width: button, height: button, top: inset * 0.8, right: inset + i * (button + gap) }} />
      ))}
    </div>
  );
}

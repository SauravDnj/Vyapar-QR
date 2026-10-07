'use client';

import { createContext, useContext } from 'react';

import type { ReactNode } from 'react';

/**
 * What the app hosting a theme can do for it, beyond rendering.
 *
 * The public landing page is what a customer's phone opens straight after a
 * QR scan, so every extra server it has to reach and every oversized image it
 * downloads is time the customer stares at a blank screen. That app can serve
 * the theme's fonts itself and hand out resized images from its own origin;
 * the admin's previews can't, and keep the plain behaviour.
 */
export interface ThemeRuntime {
  /** The app has already loaded the theme's fonts (next/font), so the theme
   * must not add the Google Fonts stylesheet — a render-blocking request to
   * two more servers. */
  fontsHosted?: boolean;
  /** Images under this prefix (the API's `/uploads/`) are sent through the
   * app's own `/_next/image` optimizer: resized, WebP, and served from the
   * page's origin. Anything else is left alone, because the optimizer
   * rejects hosts it wasn't configured for. */
  optimizedImagePrefix?: string;
}

const ThemeRuntimeContext = createContext<ThemeRuntime>({});

export function ThemeRuntimeProvider({ value, children }: { value: ThemeRuntime; children: ReactNode }) {
  return <ThemeRuntimeContext.Provider value={value}>{children}</ThemeRuntimeContext.Provider>;
}

export function useThemeRuntime(): ThemeRuntime {
  return useContext(ThemeRuntimeContext);
}

/**
 * `width` must be one of Next's default image sizes (imageSizes or
 * deviceSizes), or the optimizer answers 400.
 */
export function useImageSrc(): (url: string, width: number) => string {
  const { optimizedImagePrefix } = useThemeRuntime();
  return (url, width) =>
    optimizedImagePrefix && url.startsWith(optimizedImagePrefix)
      ? `/_next/image?url=${encodeURIComponent(url)}&w=${String(width)}&q=75`
      : url;
}

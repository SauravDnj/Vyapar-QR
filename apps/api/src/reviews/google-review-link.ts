/**
 * Builds the URL that opens Google's "write a review" dialog.
 *
 * **There is no way to post a review to Google on a customer's behalf.**
 * Google exposes no write API for reviews, and it never will for the obvious
 * reason: a review has to come from a real signed-in account or the rating
 * system is worthless. The most any product can do — and what every
 * review-funnel tool actually does — is take the customer straight to Google's
 * own review box with the business already selected, so the only thing left
 * for them to do is type and press post.
 *
 * Nor can Google's review box be shown inside the landing page: every
 * google.com page sends `X-Frame-Options: SAMEORIGIN`, so an iframe renders
 * blank. The customer is always handed off to Google's own page or app.
 *
 * `search.google.com/local/writereview` is the canonical deep link for that.
 * It opens the review dialog in the Google app on a phone, or in the browser
 * against whatever Google account the visitor is signed into.
 */
export function buildGoogleReviewUrl(options: {
  /** A link the client pasted in themselves — a share.google link, a Maps
   * link, or a write-review link. */
  reviewLink?: string | null;
  /** The Google Place ID, from which a correct link can always be derived. */
  googlePlaceId?: string | null;
}): string | null {
  const manual = options.reviewLink?.trim();
  const manualIsUrl = Boolean(manual && /^https?:\/\//i.test(manual));

  // A Place ID beats a pasted share link: it opens the review box itself,
  // where a share link only opens the business profile, one tap short.
  const placeId =
    blankToNull(options.googlePlaceId) ?? (manualIsUrl ? parseGoogleLink(manual ?? '').placeId : null);
  if (placeId) {
    return writeReviewUrl(placeId);
  }

  // A client who pasted something that isn't a URL (a business name, a bare
  // domain) gets nothing rather than a broken redirect — the funnel then keeps
  // them on the page instead of sending them somewhere that 404s.
  return manualIsUrl ? (manual ?? null) : null;
}

/** Trims a value and treats an empty result as absent. */
export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : null;
}

export function writeReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/** Hosts a Google Business Profile link can live on: `share.google` (the
 * current "Share" button), `g.page`, `maps.app.goo.gl`, and any google.*
 * domain (Maps, Search, the write-review page). */
const GOOGLE_HOST = /(^|\.)(google\.[a-z]{2,3}(\.[a-z]{2})?|goo\.gl|g\.page|g\.co|share\.google)$/i;

export function isGoogleLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && GOOGLE_HOST.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export interface ParsedGoogleLink {
  /** Present on write-review links and some Maps links. */
  placeId: string | null;
  /** The business name, when the link is a Google Search/Maps query for it —
   * what a share.google link resolves to. */
  businessName: string | null;
}

export function parseGoogleLink(value: string): ParsedGoogleLink {
  try {
    const url = new URL(value.trim());
    const placeId = url.searchParams.get('placeid') ?? url.searchParams.get('query_place_id');
    const query = url.searchParams.get('q') ?? url.searchParams.get('query');
    return {
      placeId: placeId && /^[A-Za-z0-9_-]{10,}$/.test(placeId) ? placeId : null,
      businessName: blankToNull(query),
    };
  } catch {
    return { placeId: null, businessName: null };
  }
}

const MAX_REDIRECTS = 6;
const RESOLVE_TIMEOUT_MS = 6000;

/**
 * Follows a short link (share.google, maps.app.goo.gl, g.page) to where it
 * really points, so the admin can see which business it opens before saving.
 * Redirects are followed by hand and stop at the first non-Google host, so
 * this can't be turned into a fetch-anything proxy.
 */
export async function resolveGoogleLink(
  value: string,
): Promise<{ finalUrl: string } & ParsedGoogleLink> {
  let current = value.trim();
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    if (!isGoogleLink(current)) {
      break;
    }
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VyaparQR link check)',
        'Accept-Language': 'en-IN,en',
      },
    });
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      break;
    }
    current = new URL(location, current).toString();
  }
  return { finalUrl: current, ...parseGoogleLink(current) };
}

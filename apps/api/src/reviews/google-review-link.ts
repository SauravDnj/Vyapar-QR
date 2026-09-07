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
 * `search.google.com/local/writereview` is the canonical deep link for that.
 * It opens the review dialog in the Google app on a phone, or in the browser
 * against whatever Google account the visitor is signed into.
 */
export function buildGoogleReviewUrl(options: {
  /** A link the client pasted in themselves. Trusted first if it looks usable. */
  reviewLink?: string | null;
  /** The Google Place ID, from which a correct link can always be derived. */
  googlePlaceId?: string | null;
}): string | null {
  const manual = options.reviewLink?.trim();
  if (manual && /^https?:\/\//i.test(manual)) {
    return manual;
  }

  const placeId = options.googlePlaceId?.trim();
  if (placeId) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
  }

  // A client who pasted something that isn't a URL (a business name, a bare
  // domain) gets nothing rather than a broken redirect — the funnel then keeps
  // them on the page instead of sending them somewhere that 404s.
  return null;
}

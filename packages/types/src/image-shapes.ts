/**
 * The shapes the landing page draws its images into.
 *
 * One definition, read by both sides: the theme sizes its logo circle and its
 * banner from these, and the admin's crop step frames the image to the same
 * shape before it is uploaded. They used to be two separate guesses — the
 * crop was 3:1 while the page's banner took its height from the screen's
 * height, so it came out nearer 2.3:1 and cut the sides off an image that had
 * already been cropped. Change a shape here and both follow.
 */
export interface ImageShape {
  /** width ÷ height */
  aspect: number;
  /** Pixel width the crop step exports; height follows from `aspect`. */
  outputWidth: number;
  /** Drawn in a circle. The file is still square; the page masks it. */
  round: boolean;
  label: string;
  /** What the admin tells the owner, e.g. "Square · 512 × 512". */
  hint: string;
}

export const LOGO_IMAGE: ImageShape = {
  aspect: 1,
  outputWidth: 512,
  round: true,
  label: 'Logo',
  hint: 'Square, shown in a circle · saved at 512 × 512',
};

export const BANNER_IMAGE: ImageShape = {
  aspect: 3,
  // 1500 wide covers a 430px-wide phone at 3× density without upscaling.
  outputWidth: 1500,
  round: false,
  label: 'Background banner',
  hint: 'Wide 3 : 1 banner across the top of your page · saved at 1500 × 500',
};

/**
 * Where the page puts things over the banner, as fractions of its width, so
 * the crop step can show them. The logo circle sits on the banner's bottom
 * edge, centred; the share / save buttons sit in the top-right corner.
 */
export const BANNER_OVERLAY = {
  /** Logo circle diameter ÷ banner width, on a typical 390px phone. */
  logoDiameter: 92 / 390,
  /** Share / save button diameter ÷ banner width. */
  buttonDiameter: 44 / 390,
  /** Distance from the banner's top and right edges ÷ banner width. */
  buttonInset: 18 / 390,
  buttonGap: 8 / 390,
  /** From this fraction of the banner's height down, the picture softens into
   * a blurred copy of itself and then into the page, instead of ending in a
   * hard line. The crop step shades the same band. */
  fadeFrom: 0.74,
};

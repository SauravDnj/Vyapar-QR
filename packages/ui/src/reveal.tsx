/**
 * Fades a theme section in as it scrolls into view.
 *
 * **Content is visible by default and animation is pure enhancement.** The
 * previous implementation used framer-motion's `whileInView`, which renders
 * the section at `opacity: 0` and relies on JavaScript to reveal it. In
 * production that observer never fired for sections below the fold, so the
 * review funnel, testimonials, social buttons and contact form were invisible
 * on every customer page — the product's core features, permanently hidden.
 *
 * This version cannot fail that way. It is a plain server component with no
 * JavaScript at all: the animation is a CSS scroll-driven animation
 * (`animation-timeline: view()`, see `qr-reveal` in each app's globals.css).
 * Browsers without support simply show the content, and the animation is
 * skipped entirely under `prefers-reduced-motion`.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  /** Seconds of stagger, applied as an animation delay. */
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={className ? `qr-reveal ${className}` : 'qr-reveal'}
      style={delay ? { animationDelay: `${String(delay)}s` } : undefined}
    >
      {children}
    </div>
  );
}

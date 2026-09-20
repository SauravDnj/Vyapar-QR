/**
 * The real brand marks, drawn as vectors.
 *
 * The theme used to show its own outline glyphs for WhatsApp, Instagram and
 * Facebook — a hand-drawn bubble, a rounded rectangle with a circle in it —
 * on the reasoning that the official logos are trademarked. That reasoning is
 * backwards for this product: every one of these platforms publishes its mark
 * precisely so that third parties can label a link that goes to them, and a
 * customer scanning a shop's QR code recognises the green WhatsApp bubble in a
 * way they will never recognise a generic chat outline. Recognition *is* the
 * job of the button.
 *
 * These are vectors rather than PNGs on purpose. They are the same artwork,
 * but they stay sharp on every screen density, they theme their own size, and
 * a page opened from a paper QR code on mobile data pays nothing extra to
 * fetch them — eight logo files would be eight more round trips before the
 * buttons could be identified. If you want to swap in an official asset file
 * later, each mark below is one self-contained component to replace.
 *
 * Every mark is `aria-hidden`: each one sits beside its own visible text label
 * ("WhatsApp", "Google Pay"), so announcing it again would only add noise.
 */

export type BrandName =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'google'
  | 'gpay'
  | 'phonepe'
  | 'paytm'
  | 'upi';

interface MarkProps {
  className?: string;
}

const box = (className?: string) => ({
  className,
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true as const,
  focusable: 'false' as const,
});

/** WhatsApp: the handset-in-a-bubble, white on brand green. */
export function WhatsAppMark({ className }: MarkProps) {
  return (
    <svg {...box(className)}>
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        fill="#FFF"
        d="M16.2 13.9c-.22-.11-1.32-.65-1.53-.72-.2-.08-.35-.12-.5.11-.15.23-.57.72-.7.87-.13.15-.26.17-.48.06-.22-.11-.94-.35-1.79-1.11-.66-.59-1.11-1.32-1.24-1.54-.13-.23-.01-.35.1-.46.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.08-.15.04-.28-.02-.39-.06-.11-.5-1.21-.69-1.65-.18-.43-.36-.38-.5-.38h-.43c-.15 0-.39.06-.59.28-.2.23-.78.76-.78 1.86s.8 2.16.91 2.31c.11.15 1.57 2.4 3.81 3.37.53.23.95.36 1.27.47.53.17 1.02.15 1.4.09.43-.06 1.32-.54 1.5-1.06.19-.52.19-.97.13-1.06-.05-.09-.2-.15-.42-.26Z"
      />
      <path
        fill="#FFF"
        d="M12.05 5.4a6.56 6.56 0 0 0-5.56 10.05l.16.25-.66 2.42 2.48-.65.24.14a6.55 6.55 0 0 0 3.34.92h.003a6.56 6.56 0 0 0 0-13.12Zm0 11.94h-.002a5.45 5.45 0 0 1-2.78-.76l-.2-.12-2.07.54.55-2.02-.13-.21a5.45 5.45 0 1 1 4.63 2.57Z"
      />
    </svg>
  );
}

/** Instagram: the camera outline on the official corner-to-corner gradient. */
export function InstagramMark({ className }: MarkProps) {
  return (
    <svg {...box(className)}>
      <defs>
        <radialGradient id="vq-ig" cx="0.3" cy="1.05" r="1.3">
          <stop offset="0" stopColor="#FEDA75" />
          <stop offset="0.25" stopColor="#FA7E1E" />
          <stop offset="0.5" stopColor="#D62976" />
          <stop offset="0.75" stopColor="#962FBF" />
          <stop offset="1" stopColor="#4F5BD5" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill="url(#vq-ig)" />
      <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="4.2" fill="none" stroke="#FFF" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="#FFF" strokeWidth="1.6" />
      <circle cx="16.05" cy="7.95" r="1" fill="#FFF" />
    </svg>
  );
}

/** Facebook: the white f on brand blue. */
export function FacebookMark({ className }: MarkProps) {
  return (
    <svg {...box(className)}>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#FFF"
        d="M15.3 13.34 15.74 10.5h-2.72V8.66c0-.78.38-1.53 1.6-1.53h1.24V4.71s-1.13-.19-2.2-.19c-2.25 0-3.71 1.36-3.71 3.82V10.5H7.46v2.84h2.49v6.86a9.9 9.9 0 0 0 3.07 0v-6.86h2.28Z"
      />
    </svg>
  );
}

/** Google: the four-colour G, used wherever the destination is Google — the
 * review funnel, and the Google Pay lockup below. */
export function GoogleMark({ className }: MarkProps) {
  return (
    <svg {...box(className)}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.59-5.17 3.59-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

/** Google Pay: the G lockup. Wider than it is tall, so it gets its own box. */
export function GooglePayMark({ className }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 48 24" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false">
      <g transform="translate(0 2) scale(.833)">
        <path
          fill="#4285F4"
          d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.59-5.17 3.59-8.87Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
        />
        <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z" />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
        />
      </g>
      <text
        x="23.5"
        y="17"
        fill="#5F6368"
        fontFamily="Montserrat, ui-sans-serif, system-ui, sans-serif"
        fontSize="13"
        fontWeight="500"
      >
        Pay
      </text>
    </svg>
  );
}

/** PhonePe: the white rupee on brand purple. */
export function PhonePeMark({ className }: MarkProps) {
  return (
    <svg {...box(className)}>
      <rect width="24" height="24" rx="5" fill="#5F259F" />
      {/* The rupee as a glyph rather than as an outline path: at the 14px the
          pay bar shows these at, a traced ₹ turned into a white smudge. */}
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fill="#FFF"
        fontFamily="Montserrat, ui-sans-serif, system-ui, sans-serif"
        fontSize="15"
        fontWeight="600"
      >
        ₹
      </text>
    </svg>
  );
}

/** Paytm: the two-tone wordmark — "Pay" navy, "tm" cyan. */
export function PaytmMark({ className }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 48 24" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false">
      <text
        x="1"
        y="17"
        fontFamily="Montserrat, ui-sans-serif, system-ui, sans-serif"
        fontSize="14.5"
        fontWeight="700"
        letterSpacing="-.4"
      >
        <tspan fill="#002970">Pay</tspan>
        <tspan fill="#00BAF2">tm</tspan>
      </text>
    </svg>
  );
}

/** UPI: the orange/green chevrons beside the wordmark, for "any UPI app". */
export function UpiMark({ className }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 48 24" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false">
      <path fill="#F26522" d="M4.6 3.8h4.3l-4 16.4H.6l4-16.4Z" />
      <path fill="#0F9D58" d="M10.6 3.8h4.3l-4 16.4H6.6l4-16.4Z" />
      <text
        x="17.5"
        y="17"
        fill="#0C0A09"
        fontFamily="Montserrat, ui-sans-serif, system-ui, sans-serif"
        fontSize="13"
        fontWeight="700"
        letterSpacing=".4"
      >
        UPI
      </text>
    </svg>
  );
}

const MARKS: Record<BrandName, (props: MarkProps) => React.JSX.Element> = {
  whatsapp: WhatsAppMark,
  instagram: InstagramMark,
  facebook: FacebookMark,
  google: GoogleMark,
  gpay: GooglePayMark,
  phonepe: PhonePeMark,
  paytm: PaytmMark,
  upi: UpiMark,
};

/** True for the marks that are a wordmark lockup, so they need a wide slot
 * rather than a square one. */
export const WIDE_MARKS = new Set<BrandName>(['gpay', 'paytm', 'upi']);

export function PlatformLogo({ brand, className }: { brand: BrandName; className?: string }) {
  const Mark = MARKS[brand];
  return <Mark className={className} />;
}

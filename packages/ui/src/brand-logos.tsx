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
  | 'linkedin'
  | 'x'
  | 'youtube'
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

/** WhatsApp: the canonical handset-in-a-bubble, white on brand green.
 * The previous pair of hand-fitted paths collapsed into a white blob once the
 * pay bar scaled it to 14px. */
export function WhatsAppMark({ className }: MarkProps) {
  return (
    <svg {...box(className)}>
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        fill="#FFF"
        d="M16.63 13.96c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.93-1.19-.71-.64-1.19-1.42-1.33-1.66-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.47-.39-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.57.18 1.1.16 1.51.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"
      />
      <path
        fill="#FFF"
        d="M19.1 4.87A9.93 9.93 0 0 0 12.04 1.95c-5.5 0-9.98 4.48-9.98 9.98 0 1.76.46 3.48 1.34 5L2 22.05l5.25-1.38a9.96 9.96 0 0 0 4.78 1.22h.004c5.5 0 9.98-4.48 9.98-9.98 0-2.67-1.04-5.17-2.92-7.05ZM12.04 20.2h-.004a8.28 8.28 0 0 1-4.22-1.16l-.3-.18-3.13.82.84-3.06-.2-.31a8.26 8.26 0 0 1-1.27-4.4c0-4.57 3.72-8.29 8.3-8.29 2.21 0 4.29.86 5.85 2.43a8.23 8.23 0 0 1 2.42 5.87c0 4.57-3.72 8.29-8.29 8.29Z"
      />
    </svg>
  );
}

/** LinkedIn: the white "in" on brand blue. */
export function LinkedInMark({ className }: MarkProps) {
  return (
    <svg {...box(className)}>
      <rect width="24" height="24" rx="4.5" fill="#0A66C2" />
      <path
        fill="#FFF"
        d="M7.2 9.6H4.9V19h2.3V9.6Zm-1.15-3.7a1.34 1.34 0 1 0 0 2.68 1.34 1.34 0 0 0 0-2.68ZM19.1 13.62c0-2.5-1.34-3.66-3.12-3.66-1.44 0-2.08.79-2.44 1.35V9.6h-2.3c.03.65 0 9.4 0 9.4h2.3v-5.25c0-.21.02-.42.08-.57.16-.41.54-.84 1.18-.84.83 0 1.17.63 1.17 1.56V19h2.3l.03-5.38Z"
      />
    </svg>
  );
}

/** X: the wordmark glyph, white on black. */
export function XMark({ className }: MarkProps) {
  return (
    <svg {...box(className)}>
      <rect width="24" height="24" rx="4.5" fill="#000" />
      <path
        fill="#FFF"
        d="M15.9 5.5h2.1l-4.6 5.26L18.9 18.5h-4.24l-3.32-4.34-3.8 4.34H5.43l4.92-5.62L5.1 5.5h4.35l3 3.97 3.45-3.97Zm-.74 11.74h1.17L9.06 6.69H7.81l7.35 10.55Z"
      />
    </svg>
  );
}

/** YouTube: the white play triangle on the brand red rounded rectangle. */
export function YouTubeMark({ className }: MarkProps) {
  return (
    <svg {...box(className)}>
      <rect y="4.5" width="24" height="15" rx="4.2" fill="#FF0000" />
      <path fill="#FFF" d="M9.9 8.7v6.6l5.7-3.3-5.7-3.3Z" />
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
  linkedin: LinkedInMark,
  x: XMark,
  youtube: YouTubeMark,
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

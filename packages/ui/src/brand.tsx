/**
 * Vyapar QR's own brand — the product name and logo, shared by the admin and
 * landing apps so the two can never drift apart. Client landing pages carry
 * the client's brand, not this one; the only place it appears there is the
 * "Powered by" footer line, which white-label plans hide.
 */
export const BRAND_NAME = 'Vyapar QR';

export const BRAND_TAGLINE = 'One QR for payments, reviews and WhatsApp';

/**
 * The logo mark: a QR code reduced to its three finder squares, with a tick in
 * the fourth corner for a payment received. Colors are fixed rather than
 * inherited so the mark reads the same on light and dark surfaces.
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label={BRAND_NAME}
    >
      <rect width="32" height="32" rx="8" fill="#0866ff" />
      {(
        [
          [5, 5],
          [18, 5],
          [5, 18],
        ] as const
      ).map(([x, y]) => (
        <g key={`${String(x)}-${String(y)}`}>
          <rect x={x} y={y} width="9" height="9" rx="2.25" fill="#ffffff" />
          <rect x={x + 2} y={y + 2} width="5" height="5" rx="1.25" fill="#0866ff" />
          <rect x={x + 3.5} y={y + 3.5} width="2" height="2" rx="0.5" fill="#ffffff" />
        </g>
      ))}
      <path
        d="M18.75 22.5l2.75 2.75 5.75-6.5"
        fill="none"
        stroke="#25d366"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark plus wordmark. `suffix` labels the area, e.g. "Super Admin". */
export function BrandLogo({
  size = 28,
  suffix,
  className,
}: {
  size?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <BrandMark size={size} />
      <span className="text-base font-bold leading-none tracking-tight">
        Vyapar <span style={{ color: '#0866ff' }}>QR</span>
      </span>
      {suffix ? (
        <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-medium leading-none opacity-70">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

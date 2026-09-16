import { BRAND_NAME, BrandLogo, BrandMark } from '@vyaparqr/ui';

/** Where "Get started" and "Sign in" go. Set NEXT_PUBLIC_ADMIN_APP_URL on the
 * landing project; the production fallback is the live admin app, so the
 * homepage never sends a visitor to a developer's localhost. */
const ADMIN_APP_URL =
  process.env.NEXT_PUBLIC_ADMIN_APP_URL ??
  (process.env.NODE_ENV === 'production' ? 'https://qrhub-admin.vercel.app' : 'http://localhost:3001');

const FEATURES = [
  {
    title: 'UPI payments in one tap',
    body: 'GPay, PhonePe and Paytm buttons open the customer’s app with your UPI ID filled in. No gateway, no fees.',
  },
  {
    title: 'More Google reviews',
    body: 'Happy customers go straight to your Google review page. Unhappy ones reach you privately first.',
  },
  {
    title: 'WhatsApp and social',
    body: 'Click-to-chat on WhatsApp, plus Instagram and Facebook — every enquiry lands in your leads.',
  },
  {
    title: 'Your page, your look',
    body: 'Pick from over a hundred themes, add your logo, gallery, menu and locations. Update any time.',
  },
];

const STEPS = [
  { title: 'Register', body: 'Create your account and add your business details once.' },
  { title: 'Get your QR', body: 'Download one QR code for your counter, table, packaging or card.' },
  { title: 'Grow', body: 'Customers scan to pay, review and chat. You track every scan and lead.' },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="border-b border-border-color">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandLogo />
          <nav className="flex items-center gap-2 text-sm font-medium">
            <a href={`${ADMIN_APP_URL}/login`} className="rounded-md px-3 py-2 text-muted hover:text-foreground">
              Sign in
            </a>
            <a
              href={`${ADMIN_APP_URL}/register`}
              className="rounded-md bg-accent px-4 py-2 text-accent-foreground hover:bg-accent-hover"
            >
              Get started
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div className="space-y-6">
            <p className="inline-flex rounded-full bg-info-bg px-3 py-1 text-xs font-semibold text-info">
              Built for Indian businesses
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              One QR code for payments, reviews and WhatsApp.
            </h1>
            <p className="max-w-xl text-lg text-muted">
              {BRAND_NAME} turns a single scan into a page for your business — customers pay you by UPI, leave a
              Google review and message you on WhatsApp, all in a few seconds.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`${ADMIN_APP_URL}/register`}
                className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
              >
                Create your free page
              </a>
              <a
                href={`${ADMIN_APP_URL}/register-agency`}
                className="rounded-md border border-border-color px-5 py-3 text-sm font-semibold hover:border-accent"
              >
                For agencies
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-xs rounded-lg border border-border-color bg-surface p-6 text-center shadow-[var(--shadow-card)]">
            <BrandMark size={140} className="mx-auto" />
            <p className="mt-5 text-sm font-semibold">Scan · Pay · Review · Chat</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium">
              <span className="rounded-md bg-success-bg px-2 py-2 text-success">UPI payment</span>
              <span className="rounded-md bg-warning-bg px-2 py-2 text-warning">Google review</span>
              <span className="rounded-md bg-success-bg px-2 py-2 text-success">WhatsApp</span>
              <span className="rounded-md bg-info-bg px-2 py-2 text-info">Save contact</span>
            </div>
          </div>
        </section>

        <section className="border-y border-border-color bg-surface">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="space-y-2">
                <h2 className="font-semibold">{feature.title}</h2>
                <p className="text-sm text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight">Live in three steps</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-lg border border-border-color p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-border-color">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:px-6">
          <BrandLogo size={22} />
          <p>
            © {new Date().getFullYear()} {BRAND_NAME}
          </p>
        </div>
      </footer>
    </div>
  );
}

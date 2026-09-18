# Waloop demo

The demo page: <https://qrhub-landing.vercel.app/site/waloop>

- `waloop-qr.png` — the QR for that page (1024px, decodes to the URL above).
- `waloop-qr-poster.pdf` — an A5 poster to print and stand on a counter.

Regenerate either for any page:

```bash
cd apps/api
node scripts/demo-qr.js "https://qrhub-landing.vercel.app/site/<slug>" "<Business name>"
```

## Filling the page

`apps/api/prisma/seed-demo-client.ts` (`pnpm --filter api db:demo`) fills an
existing client's page with demo content so every button works: tagline,
about, address, hours, phone, the "any UPI app" option beside the named one,
and the current theme. It keeps whatever real UPI ID and WhatsApp number the
account already has, and it is safe to re-run.

Override any value with an env var: `DEMO_SLUG`, `DEMO_TAGLINE`, `DEMO_ABOUT`,
`DEMO_ADDRESS`, `DEMO_HOURS`, `DEMO_PHONE`, `DEMO_FOOTER`, `DEMO_INSTAGRAM`,
`DEMO_BOOKING_URL`, and `DEMO_REVIEW_LINK` — the last one enables the Review
button and must be the business's own Google Business share link.

It does **not** invent testimonials, ratings, offers or loyalty programs.
Those are claims made to the public in the business's name.

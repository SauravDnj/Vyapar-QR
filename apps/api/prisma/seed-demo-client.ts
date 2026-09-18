import 'dotenv/config';

import { DEFAULT_THEME_NAME } from '@vyaparqr/types';

import { JsonDbClient } from '../src/jsondb';

/**
 * Fills a live client's page with demo content so every button on it works.
 *
 * Written for the Waloop demo: the account already exists with a real UPI ID
 * and WhatsApp number, but no tagline, address, hours or phone — so the page
 * showed a name and a Pay button and nothing else. This fills the gaps, adds
 * the "any UPI app" option beside the named one, and puts the page on the
 * current theme.
 *
 * What it deliberately does NOT invent: customer testimonials, ratings,
 * offers and loyalty programs. Those are claims made to the public in the
 * business's name, and a demo is not a reason to fabricate them. The Google
 * review link is only set when you pass one, because it points at a real
 * Google Business Profile.
 *
 * Idempotent: re-running it updates the same rows rather than duplicating.
 *
 * Usage (values in caps are overridable env vars):
 *   DEMO_SLUG=waloop ts-node prisma/seed-demo-client.ts
 */
const prisma = new JsonDbClient();

const SLUG = process.env.DEMO_SLUG ?? 'waloop';

const CONTENT = {
  tagline: process.env.DEMO_TAGLINE ?? 'One QR code for your business — payments, reviews and WhatsApp in a single tap',
  description:
    process.env.DEMO_ABOUT ??
    'Waloop gives a business one QR code that opens its own page: customers pay by UPI, leave a Google review, or start a WhatsApp chat — no app to install, nothing to print again when details change.',
  address: process.env.DEMO_ADDRESS ?? 'Ahmedabad, Gujarat',
  hours: process.env.DEMO_HOURS ?? 'Mon–Sat · 10am – 7pm',
  phone: process.env.DEMO_PHONE ?? '+918758018050',
  footer: process.env.DEMO_FOOTER ?? '© Waloop',
  /** Optional: a Google Business share link enables the Review button. */
  reviewLink: process.env.DEMO_REVIEW_LINK ?? '',
  /** Optional: an Instagram handle or URL adds the Follow section. */
  instagram: process.env.DEMO_INSTAGRAM ?? '',
  /** Optional: a booking URL adds the Book button. */
  bookingUrl: process.env.DEMO_BOOKING_URL ?? '',
};

async function main() {
  const client = await prisma.client.findUnique({
    where: { slug: SLUG },
    include: { landingPage: true, paymentMethods: true, socialLinks: true, googleReviewConfig: true },
  });
  if (!client) {
    throw new Error(`No client with slug "${SLUG}". Set DEMO_SLUG to an existing one.`);
  }
  if (!client.landingPage) {
    throw new Error(`"${SLUG}" has no landing page yet — finish onboarding first.`);
  }

  const done: string[] = [];

  // ── page content ───────────────────────────────────────────────────────
  const existing = (client.landingPage.contentJson ?? {}) as Record<string, Record<string, string> | undefined>;
  const content = {
    ...existing,
    hero: { ...existing.hero, headline: existing.hero?.headline ?? client.businessName, tagline: CONTENT.tagline },
    about: {
      ...existing.about,
      description: CONTENT.description,
      address: CONTENT.address,
      hours: CONTENT.hours,
      phone: CONTENT.phone,
    },
    contact: { ...existing.contact, ...(CONTENT.bookingUrl ? { bookingUrl: CONTENT.bookingUrl } : {}) },
    footer: { ...existing.footer, text: CONTENT.footer },
  };

  // The page is only served while its theme row exists, and a page pointing
  // at a retired theme renders the default anyway — so point it at the real
  // row and the stored name stops lying about what visitors see.
  const theme = await prisma.theme.findFirst({ where: { name: DEFAULT_THEME_NAME } });

  await prisma.landingPage.update({
    where: { id: client.landingPage.id },
    data: {
      contentJson: content,
      status: 'published',
      publishedAt: client.landingPage.publishedAt ?? new Date(),
      ...(theme ? { themeId: theme.id } : {}),
    },
  });
  done.push(`page content (tagline, about, ${CONTENT.address}, hours, phone)`);
  done.push(theme ? `theme → ${DEFAULT_THEME_NAME}` : 'theme unchanged (run db:sync-themes first)');

  // ── payment: the named app plus "any UPI app" ──────────────────────────
  const upiId = client.paymentMethods.find((method) => method.upiId)?.upiId ?? null;
  const hasAnyUpi = client.paymentMethods.some((method) => method.type === 'other');
  if (upiId && !hasAnyUpi) {
    await prisma.paymentMethod.create({
      data: {
        clientId: client.id,
        type: 'other',
        upiId,
        displayOrder: client.paymentMethods.length,
      },
    });
    done.push('payment: added "any UPI app" beside the existing one');
  } else if (!upiId) {
    done.push('payment: SKIPPED — no UPI ID on the account yet');
  }

  // ── socials ────────────────────────────────────────────────────────────
  if (CONTENT.instagram && !client.socialLinks.some((link) => link.platform === 'instagram')) {
    await prisma.socialLink.create({
      data: {
        clientId: client.id,
        platform: 'instagram',
        value: CONTENT.instagram,
        displayOrder: client.socialLinks.length,
      },
    });
    done.push('social: Instagram added');
  }

  // ── Google review link (only when given) ───────────────────────────────
  if (CONTENT.reviewLink) {
    const data = { reviewLink: CONTENT.reviewLink, feedbackWhatsappNumber: CONTENT.phone };
    if (client.googleReviewConfig) {
      await prisma.googleReviewConfig.update({ where: { clientId: client.id }, data });
    } else {
      await prisma.googleReviewConfig.create({ data: { clientId: client.id, ...data } });
    }
    done.push('reviews: link saved — the Review button is live');
  } else {
    done.push('reviews: SKIPPED — pass DEMO_REVIEW_LINK=<your Google share link> to enable the Review button');
  }

  console.log(`Storage driver: ${prisma.store.driverName}`);
  console.log(`Demo ready for "${client.businessName}" (/site/${SLUG}):`);
  for (const line of done) {
    console.log(`  • ${line}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

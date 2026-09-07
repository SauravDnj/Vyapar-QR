import 'dotenv/config';

import { DEFAULT_THEME_SCHEMA } from '@qrhub/types';
import * as bcrypt from 'bcrypt';

import { JsonDbClient } from '../src/jsondb';

import type { Prisma } from '../src/jsondb';

// Writes through whichever driver JSONDB_DRIVER selects, so the same command
// seeds a local `data/jsondb/` directory or a Vercel Blob store.
const prisma = new JsonDbClient();

const themeSchemaJson = DEFAULT_THEME_SCHEMA as unknown as Prisma.InputJsonValue;

async function main() {
  // Overridable so a real deploy doesn't ship with a published default
  // password. The fallback stays for local development.
  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@qrhub.local';
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

  if (!process.env.SEED_SUPER_ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to seed a production database with the default super-admin password. ' +
        'Set SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD.',
    );
  }

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      passwordHash: await bcrypt.hash(superAdminPassword, 10),
      role: 'super_admin',
      status: 'active',
    },
  });

  const plans = [
    {
      name: 'Starter',
      price: 499,
      billingCycle: 'monthly' as const,
      maxThemes: 3,
      customDomainAllowed: false,
      featuresJson: { analytics: false, customDomain: false, whiteLabel: false },
    },
    {
      name: 'Pro',
      price: 999,
      billingCycle: 'monthly' as const,
      maxThemes: 10,
      customDomainAllowed: false,
      featuresJson: { analytics: true, customDomain: false, whiteLabel: false },
    },
    {
      name: 'Business',
      price: 2499,
      billingCycle: 'monthly' as const,
      maxThemes: 999,
      customDomainAllowed: true,
      featuresJson: { analytics: true, customDomain: true, whiteLabel: true },
    },
  ];

  for (const plan of plans) {
    const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.plan.create({ data: plan });
    } else {
      // Backfill new feature flags (e.g. `whiteLabel`) onto already-seeded
      // plans without touching price/name a Super Admin may have edited.
      await prisma.plan.update({ where: { id: existing.id }, data: { featuresJson: plan.featuresJson } });
    }
  }

  const themes = [
    { name: 'Minimal', category: 'General' },
    { name: 'Bold', category: 'General' },
    { name: 'Elegant', category: 'General' },
    { name: 'Spice', category: 'Restaurant' },
    { name: 'Serene', category: 'Salon & Spa' },
    { name: 'Storefront', category: 'Retail' },
    { name: 'Trustline', category: 'Services' },
    { name: 'Executive', category: 'Professional' },
    { name: 'Vitality', category: 'Healthcare & Fitness' },
    { name: 'Ironclad', category: 'Automotive & Home Services' },
    { name: 'Nest', category: 'Real Estate' },
    { name: 'Aperture', category: 'Photography & Creative' },
    { name: 'Academy', category: 'Education & Coaching' },
  ];

  for (const theme of themes) {
    const existing = await prisma.theme.findFirst({ where: { name: theme.name } });
    if (!existing) {
      await prisma.theme.create({
        data: {
          name: theme.name,
          category: theme.category,
          schemaJson: themeSchemaJson,
          isPremium: false,
        },
      });
    } else {
      await prisma.theme.update({ where: { id: existing.id }, data: { schemaJson: themeSchemaJson } });
    }
  }

  console.log('Seed complete:');
  console.log(`  Storage driver: ${prisma.store.driverName}`);
  console.log(`  Super Admin: ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`  Plans: ${plans.map((p) => p.name).join(', ')}`);
  console.log(`  Themes: ${themes.map((t) => t.name).join(', ')}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
    // The blob driver's HTTP client keeps sockets alive, which holds the event
    // loop open long after the work is done. Exit explicitly so this doesn't
    // hang a terminal or a CI step.
    process.exit(process.exitCode ?? 0);
  });

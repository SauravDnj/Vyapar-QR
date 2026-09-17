import 'dotenv/config';

import * as bcrypt from 'bcrypt';

import { JsonDbClient } from '../src/jsondb';

import { syncThemes } from './sync-themes';

// Writes through whichever driver JSONDB_DRIVER selects, so the same command
// seeds a local `data/jsondb/` directory or a Vercel Blob store.
const prisma = new JsonDbClient();

async function main() {
  // Overridable so a real deploy doesn't ship with a published default
  // password. The fallback stays for local development.
  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@vyaparqr.local';
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

  // Themes come from the shared catalog, so the picker and the renderer can
  // never disagree about what exists. Anything outside it is retired.
  const themeSync = await syncThemes(prisma);

  console.log('Seed complete:');
  console.log(`  Storage driver: ${prisma.store.driverName}`);
  console.log(`  Super Admin: ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`  Plans: ${plans.map((p) => p.name).join(', ')}`);
  console.log(`  Themes: ${themeSync.kept.join(', ')} (${String(themeSync.removed)} retired)`);
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

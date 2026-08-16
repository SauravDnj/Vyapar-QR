import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_THEME_SCHEMA } from '@qrhub/types';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

const themeSchemaJson = DEFAULT_THEME_SCHEMA as unknown as Prisma.InputJsonValue;

async function main() {
  const superAdminEmail = 'admin@qrhub.local';
  const superAdminPassword = 'ChangeMe123!';

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
  });

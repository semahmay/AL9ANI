import { resolve } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';

import { resolveDatabaseUrl } from '../src/config/database-url';
import { PrismaClient } from '../src/generated/prisma/client';

loadEnv({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const categories = [
  {
    name: 'Beauty & Wellness',
    slug: 'beauty-wellness',
    description: 'Beauty salons, skincare, nail care, and wellness treatments.',
  },
  {
    name: 'Hair & Barber',
    slug: 'hair-barber',
    description: 'Hair salons, barbershops, styling, and grooming.',
  },
  {
    name: 'Pilates & Yoga',
    slug: 'pilates-yoga',
    description: 'Pilates, yoga, stretching, and mindful movement studios.',
  },
  {
    name: 'Fitness & Gym',
    slug: 'fitness-gym',
    description: 'Gyms, personal training, group fitness, and strength classes.',
  },
  {
    name: 'Padel & Racquet Sports',
    slug: 'padel-racquet-sports',
    description: 'Padel courts, tennis, squash, and other racquet activities.',
  },
  {
    name: 'Sports & Leisure',
    slug: 'sports-leisure',
    description: 'Local sports, outdoor activities, and leisure experiences.',
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: resolveDatabaseUrl() }),
  });

  try {
    for (const category of categories) {
      const saved = await prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
        },
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
        },
      });

      console.log(`Category ready: ${saved.name} (${saved.slug})`);
    }

    console.log(`Seeded ${categories.length} development categories.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Category seeding failed.');
  process.exitCode = 1;
});

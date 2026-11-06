import { resolve } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';

import { hashPassword } from '../src/auth/password';
import { resolveDatabaseUrl } from '../src/config/database-url';
import { PrismaClient } from '../src/generated/prisma/client';
import { UserRole } from '../src/generated/prisma/enums';

loadEnv({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be set to a valid email address.');
  }

  if (!password || password.length < 12 || password.length > 128) {
    throw new Error('ADMIN_PASSWORD must be between 12 and 128 characters.');
  }

  const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'Al9ani';
  const lastName = process.env.ADMIN_LAST_NAME?.trim() || 'Admin';

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: resolveDatabaseUrl() }),
  });

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        firstName,
        lastName,
        role: UserRole.ADMIN,
        isActive: true,
      },
      create: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: UserRole.ADMIN,
      },
    });

    console.log(`Admin account ready: ${user.email} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Admin provisioning failed.');
  process.exitCode = 1;
});

import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

import { resolveDatabaseUrl } from './src/config/database-url';

// npm workspace scripts run with apps/api as the working directory. Load the
// optional app-local file first, then fall back to the repository root .env.
loadEnv({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});

const hasDatabaseConfiguration =
  Boolean(process.env.DATABASE_URL?.trim()) ||
  Boolean(process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DB);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Client generation and validation do not need a URL. Migration commands
  // fail with Prisma's own message when no database is configured.
  datasource: hasDatabaseConfiguration ? { url: resolveDatabaseUrl() } : undefined,
});

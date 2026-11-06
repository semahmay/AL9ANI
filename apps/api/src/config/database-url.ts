const DEFAULT_DATABASE_HOST = '127.0.0.1';
const DEFAULT_DATABASE_PORT = '5432';

/**
 * Builds the Prisma connection string from the existing POSTGRES_* variables.
 *
 * DATABASE_URL takes precedence when present, so deployments can provide a
 * managed connection string without duplicating the local Docker settings.
 * Credentials are URL-encoded and the value is never logged.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicitUrl = env.DATABASE_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const user = env.POSTGRES_USER;
  const password = env.POSTGRES_PASSWORD;
  const database = env.POSTGRES_DB;
  const host = env.POSTGRES_HOST?.trim() || DEFAULT_DATABASE_HOST;
  const port = env.POSTGRES_PORT?.trim() || DEFAULT_DATABASE_PORT;

  if (!user || !password || !database) {
    throw new Error(
      'Database connection is not configured. Set DATABASE_URL or POSTGRES_USER, ' +
        'POSTGRES_PASSWORD, and POSTGRES_DB in the root .env file.',
    );
  }

  return (
    `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
    `@${host}:${port}/${encodeURIComponent(database)}?schema=public`
  );
}

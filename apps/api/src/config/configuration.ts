import { resolveDatabaseUrl } from './database-url';

export type CookieSameSite = 'lax' | 'strict' | 'none';

export interface AppConfiguration {
  appName: string;
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  refreshCookieName: string;
  refreshCookieSecure: boolean;
  refreshCookieSameSite: CookieSameSite;
  authRateLimitLimit: number;
  authRateLimitTtlMs: number;
  authRateLimitDisabled: boolean;
}

const DEFAULT_PORT = 3001;
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_REFRESH_COOKIE_NAME = 'al9ani_refresh';
const DEFAULT_RATE_LIMIT_LIMIT = 100;
const DEFAULT_RATE_LIMIT_TTL_MS = 60_000;

function readInteger(
  variable: string,
  rawValue: string | undefined,
  fallback: number,
  minimum = 1,
): number {
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${variable} must be an integer greater than or equal to ${minimum}.`);
  }

  return value;
}

function readBoolean(variable: string, rawValue: string | undefined, fallback: boolean): boolean {
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`${variable} must be either "true" or "false".`);
}

function readSameSite(rawValue: string | undefined): CookieSameSite {
  const value = (rawValue ?? 'lax').trim().toLowerCase();

  if (value === 'lax' || value === 'strict' || value === 'none') {
    return value;
  }

  throw new Error('AUTH_COOKIE_SAME_SITE must be one of: lax, strict, none.');
}

export default (): AppConfiguration => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const rawPort = process.env.API_PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`API_PORT must be a valid TCP port. Received: "${rawPort}"`);
  }

  const accessTokenSecret = process.env.JWT_ACCESS_SECRET;

  if (!accessTokenSecret || accessTokenSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be configured with at least 32 characters.');
  }

  const refreshCookieSecure = readBoolean(
    'AUTH_COOKIE_SECURE',
    process.env.AUTH_COOKIE_SECURE,
    nodeEnv === 'production',
  );
  const refreshCookieSameSite = readSameSite(process.env.AUTH_COOKIE_SAME_SITE);

  if (nodeEnv === 'production' && !refreshCookieSecure) {
    throw new Error('AUTH_COOKIE_SECURE must be true when NODE_ENV=production.');
  }

  if (refreshCookieSameSite === 'none' && !refreshCookieSecure) {
    throw new Error('AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true.');
  }

  return {
    appName: process.env.APP_NAME ?? 'Al9ani API',
    nodeEnv,
    port,
    corsOrigin: process.env.CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN,
    databaseUrl: resolveDatabaseUrl(),
    accessTokenSecret,
    accessTokenTtlSeconds: readInteger(
      'JWT_ACCESS_TTL_SECONDS',
      process.env.JWT_ACCESS_TTL_SECONDS,
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    ),
    refreshTokenTtlSeconds: readInteger(
      'JWT_REFRESH_TTL_SECONDS',
      process.env.JWT_REFRESH_TTL_SECONDS,
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    ),
    refreshCookieName: process.env.AUTH_COOKIE_NAME?.trim() || DEFAULT_REFRESH_COOKIE_NAME,
    refreshCookieSecure,
    refreshCookieSameSite,
    authRateLimitLimit: readInteger(
      'AUTH_RATE_LIMIT_LIMIT',
      process.env.AUTH_RATE_LIMIT_LIMIT,
      DEFAULT_RATE_LIMIT_LIMIT,
    ),
    authRateLimitTtlMs: readInteger(
      'AUTH_RATE_LIMIT_TTL_MS',
      process.env.AUTH_RATE_LIMIT_TTL_MS,
      DEFAULT_RATE_LIMIT_TTL_MS,
    ),
    authRateLimitDisabled: readBoolean(
      'AUTH_RATE_LIMIT_DISABLED',
      process.env.AUTH_RATE_LIMIT_DISABLED,
      false,
    ),
  };
};

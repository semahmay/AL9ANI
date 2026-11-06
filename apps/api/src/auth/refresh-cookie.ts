import type { CookieOptions, Request, Response } from 'express';

import type { CookieSameSite } from '../config/configuration';
import { REFRESH_COOKIE_PATH } from './auth.constants';

export interface RefreshCookieSettings {
  name: string;
  secure: boolean;
  sameSite: CookieSameSite;
  maxAgeMs: number;
}

export function readRefreshCookie(request: Request, cookieName: string): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[cookieName];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function setRefreshCookie(
  response: Response,
  token: string,
  settings: RefreshCookieSettings,
): void {
  const options: CookieOptions = {
    httpOnly: true,
    secure: settings.secure,
    sameSite: settings.sameSite,
    path: REFRESH_COOKIE_PATH,
    maxAge: settings.maxAgeMs,
  };

  response.cookie(settings.name, token, options);
}

export function clearRefreshCookie(response: Response, settings: RefreshCookieSettings): void {
  response.clearCookie(settings.name, {
    httpOnly: true,
    secure: settings.secure,
    sameSite: settings.sameSite,
    path: REFRESH_COOKIE_PATH,
  });
}

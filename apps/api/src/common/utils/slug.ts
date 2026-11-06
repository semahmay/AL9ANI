import { randomUUID } from 'node:crypto';

/**
 * Produces a URL-safe ASCII slug. Names that contain no transliterable ASCII
 * characters fall back to a short random identifier supplied by the caller.
 */
export function slugify(value: string, maxLength = 160): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.slice(0, maxLength).replace(/-+$/g, '');
}

export function slugBase(value: string, fallbackPrefix: string, maxLength = 160): string {
  return slugify(value, maxLength) || `${fallbackPrefix}-${randomUUID().slice(0, 8)}`;
}

export function withNumericSuffix(base: string, suffix: number, maxLength = 160): string {
  const tail = `-${suffix}`;
  return `${base.slice(0, Math.max(1, maxLength - tail.length)).replace(/-+$/g, '')}${tail}`;
}

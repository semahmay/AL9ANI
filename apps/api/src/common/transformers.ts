import { Transform } from 'class-transformer';

/**
 * Trims a required string while leaving non-string values untouched so the
 * validator can report the correct type error.
 */
export const Trim = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/**
 * Trims an optional string and converts an empty result to null so clients can
 * clear nullable fields or omit them. The paired validator should use
 * `@IsOptional()`, which skips both null and undefined.
 */
export const TrimOptional = (): PropertyDecorator =>
  Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });

/**
 * Trims an optional query-string value and treats an empty value as absent.
 */
export const TrimQuery = (): PropertyDecorator =>
  Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

export const NormalizeCurrency = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

export const NormalizeCountry = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

export const NormalizeSlug = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

import ar from '@/constants/translations/ar.json';
import en from '@/constants/translations/en.json';
import type { Direction, Locale } from '@/types/index';

export const locales: readonly Locale[] = ['ar', 'en'] as const;
export const defaultLocale: Locale = 'ar';

export const dictionaries = { ar, en } as const;
export type Dictionary = typeof ar;

type DotPaths<T, P extends string = ''> = {
  [K in Extract<keyof T, string>]: T[K] extends string
    ? P extends ''
      ? K
      : `${P}.${K}`
    : T[K] extends Record<string, unknown>
      ? DotPaths<T[K], P extends '' ? K : `${P}.${K}`>
      : never;
}[Extract<keyof T, string>];

export type TranslationKey = DotPaths<Dictionary>;

function lookup(obj: unknown, parts: readonly string[]): unknown {
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Arabic-first translator with English fallback and {var} interpolation. */
export function t(key: string, locale: Locale = 'ar', vars?: Record<string, string | number>): string {
  const primary = locale === 'ar' ? ar : en;
  const secondary = locale === 'ar' ? en : ar;
  const parts = key.split('.');
  const found = lookup(primary, parts);
  const fallback = lookup(secondary, parts);
  const raw =
    typeof found === 'string' ? found : typeof fallback === 'string' ? fallback : key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match: string, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/** Text direction for a locale (Arabic Defaults to RTL). */
export function getDirection(locale: Locale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export const getLocaleDirection = getDirection;

export function isRTL(locale: Locale): boolean {
  return getDirection(locale) === 'rtl';
}

/** Backwards-compatible dictionary selector (returns the whole locale dict). */
export function useT(locale: Locale = 'ar'): Dictionary {
  return locale === 'ar' ? ar : en;
}

/** Canonical production origin (custom domain on Cloudflare Pages). */
export const DEFAULT_SITE_URL = 'https://masrbounty.online';

/**
 * Normalizes a configured site URL into a clean origin.
 * Tolerates common misconfigurations such as a missing scheme
 * ("Masrbounty.online"), trailing slashes or stray whitespace, and never
 * throws — a bad value must not take the whole build down.
 */
export function normalizeSiteUrl(
  raw: string | null | undefined,
  fallback: string = DEFAULT_SITE_URL,
): string {
  const value = (raw ?? '').trim();
  if (!value) return fallback;
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

/** Public site origin derived from NEXT_PUBLIC_APP_URL. */
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL);

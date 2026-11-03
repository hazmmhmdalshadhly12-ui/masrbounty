/**
 * Shared API error envelope helpers.
 *
 * Rule: validation/user-facing messages (4xx, authored by our services) may be
 * returned verbatim; infrastructure errors (5xx from Supabase/DB/network) are
 * logged server-side and reduced to a generic client message so SQL details,
 * constraint names, RLS internals or hostnames never reach the browser.
 */

export function logServerError(scope: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  // Console only — never returned to the client, never includes secrets.
  console.error(`[api] ${scope}: ${msg}`);
}

/** Generic 500 message (safe to show clients). */
export function serverErrorMessage(): string {
  return 'حدث خطأ في الخادم — حاول لاحقًا';
}

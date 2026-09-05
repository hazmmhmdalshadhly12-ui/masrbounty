/**
 * Shared Supabase cookie policy.
 *
 * - SameSite=Lax: CSRF-safe for top-level navigation (OAuth/email callbacks),
 *   cookies still sent on same-site Server Action POSTs.
 * - Secure in production, Path=/, 7-day sliding lifetime (Supabase refreshes).
 * - HttpOnly is intentionally NOT forced: the Supabase browser client
 *   (used by login/register/MFA forms) must read the session from
 *   document.cookie. XSS is instead contained via strict CSP, React
 *   auto-escaping, and zero unsanitized HTML in the app.
 */
export function cookieOptions() {
  return {
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  };
}

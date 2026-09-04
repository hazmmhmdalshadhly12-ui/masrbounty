/**
 * CSRF check for state-changing /api routes (replaces the removed edge
 * middleware, which Cloudflare Workers could not bundle).
 * Call at the top of POST/PUT/PATCH/DELETE handlers.
 */
export function csrfBlocked(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  const host = new URL(req.url).host;
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  // Non-browser clients send neither header — allowed through
  // (RLS + auth are still enforced server-side).
  if (!origin && !referer) return false;
  const same = (v: string | null): boolean => {
    if (!v) return false;
    try {
      return new URL(v).host === host;
    } catch {
      return false;
    }
  };
  return !(same(origin) || same(referer));
}

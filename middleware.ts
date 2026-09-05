import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Pure edge middleware — NO Supabase/Node imports (Cloudflare Workers compat).
 * Layer 1 (cheap): route gating on session-cookie PRESENCE.
 * Layer 2 (authoritative): layouts/pages re-validate the session server-side
 * and RLS enforces row ownership in the database.
 */

const PROTECTED = [/^\/dashboard/, /^\/company/, /^\/admin/, /^\/profile$/, /^\/settings$/, /^\/programs\/create/];
const AUTH_PAGES = new Set(['/login', '/register']);

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies
    .getAll()
    .some((c) => c.name.includes('-auth-token') && c.value.length > 8);
}

/** Internal paths only: /x, /x/y. Rejects //, \\, protocols, external. */
export function isSafeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://') || value.includes('\\')) return null;
  if (value.startsWith('/api/')) return null;
  return value;
}

function csrfBlocked(req: NextRequest): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return false;
  if (!req.nextUrl.pathname.startsWith('/api/')) return false;
  const host = req.headers.get('host');
  if (!host) return true;
  const same = (v: string | null): boolean => {
    if (!v) return false;
    try {
      return new URL(v).host === host;
    } catch {
      return false;
    }
  };
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  if (!origin && !referer) return false;
  return !(same(origin) || same(referer));
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (csrfBlocked(req)) {
    return NextResponse.json({ ok: false, error: 'CSRF: cross-origin write blocked' }, { status: 403 });
  }

  // Lock API (except health) behind login at the edge; deep authZ stays in RLS
  if (pathname.startsWith('/api/') && pathname !== '/api/health' && !hasSessionCookie(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const authed = hasSessionCookie(req);

  if (!authed && PROTECTED.some((rx) => rx.test(pathname))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    url.searchParams.set('error', 'سجّل الدخول أولًا للوصول لهذه الصفحة');
    return NextResponse.redirect(url);
  }

  if (authed && AUTH_PAGES.has(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = isSafeNext(searchParams.get('next')) ?? '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/company/:path*',
    '/admin/:path*',
    '/profile',
    '/settings',
    '/programs/create',
    '/login',
    '/register',
    '/api/:path*',
  ],
};

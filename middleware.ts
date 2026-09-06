import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = [/^\/dashboard/, /^\/company/, /^\/admin/, /^\/profile$/, /^\/settings$/, /^\/programs\/create/];
const AUTH_PAGES = new Set(['/login', '/register']);

/** Internal paths only: /x, /x/y. Rejects //, \, protocols, external, api. */
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

function copyCookies(from: NextResponse, to: NextResponse): void {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, {
      path: c.path,
      sameSite: c.sameSite as 'lax' | 'strict' | 'none',
      secure: c.secure,
      maxAge: c.maxAge,
      expires: c.expires,
    });
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (csrfBlocked(req)) {
    return NextResponse.json({ ok: false, error: 'CSRF: cross-origin write blocked' }, { status: 403 });
  }

  const hasCookie = req.cookies
    .getAll()
    .some((c) => c.name.includes('-auth-token') && c.value.length > 8);

  // Lock API (except health) behind login at the edge; deep authZ stays in RLS
  if (pathname.startsWith('/api/') && pathname !== '/api/health') {
    if (!hasCookie) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    return NextResponse.next();
  }

  // Authoritative session refresh. Writes refreshed tokens (+ no-cache
  // headers) onto the response so rotation is never silently dropped.
  const res = NextResponse.next({ request: { headers: req.headers } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let userId: string | null = null;
  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v as string));
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } else {
    userId = hasCookie ? 'unknown' : null;
  }

  if (!userId && PROTECTED.some((rx) => rx.test(pathname))) {
    const login = req.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('next', pathname);
    login.searchParams.set('error', 'سجّل الدخول أولًا للوصول لهذه الصفحة');
    const out = NextResponse.redirect(login);
    copyCookies(res, out);
    return out;
  }

  if (userId && AUTH_PAGES.has(pathname)) {
    // Loop-breaker: a guard rejection (?error=) always renders the form.
    if (searchParams.get('error')) return res;
    const url2 = req.nextUrl.clone();
    url2.pathname = isSafeNext(searchParams.get('next')) ?? '/dashboard';
    url2.search = '';
    const out = NextResponse.redirect(url2);
    copyCookies(res, out);
    return out;
  }

  return res;
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

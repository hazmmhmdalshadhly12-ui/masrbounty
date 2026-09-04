import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isSafeMethod(method: string) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

// CSRF: for state-changing /api calls, require same-origin (Origin or Referer must match host)
function csrfBlocked(req: NextRequest): boolean {
  if (isSafeMethod(req.method)) return false;
  if (!req.nextUrl.pathname.startsWith('/api/')) return false;
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');
  if (!host) return true;
  const check = (v: string | null) => {
    if (!v) return false;
    try {
      return new URL(v).host === host;
    } catch {
      return false;
    }
  };
  // Browser same-origin fetches always send Origin (or Referer); non-browser API clients
  // without either header are allowed through (RLS + auth still enforced server-side).
  if (!origin && !referer) return false;
  return !(check(origin) || check(referer));
}

export async function middleware(req: NextRequest) {
  if (csrfBlocked(req)) {
    return NextResponse.json({ ok: false, error: 'CSRF: cross-origin write blocked' }, { status: 403 });
  }
  const res = NextResponse.next({ request: { headers: req.headers } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res;
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: object) {
        res.cookies.set(name, value, options as never);
      },
      remove(name: string, options: object) {
        res.cookies.set(name, '', options as never);
      },
    },
  });
  await supabase.auth.getSession();
  return res;
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/company/:path*', '/admin/:path*'],
};

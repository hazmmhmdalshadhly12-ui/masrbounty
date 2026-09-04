import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function client() {
  const storePromise = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars');
  return { url, anon, storePromise };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';

  const { url, anon, storePromise } = client();
  const store = await storePromise;
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* ignore */
        }
      },
    },
  });

  // PKCE flow (?code=...)
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }
  // Email-link flow (?token_hash=...&type=signup|recovery|email_change)
  else if (tokenHash && type) {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'signup' | 'recovery' | 'email_change' | 'invite',
    });
  }
  return NextResponse.redirect(`${origin}${next}`);
}

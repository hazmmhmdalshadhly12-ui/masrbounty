import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cookieOptions } from '@/lib/supabase/cookies';

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
          const base = cookieOptions();
          toSet.forEach(({ name, value, options }) => store.set(name, value, { ...base, ...options }));
        } catch {
          /* ignore */
        }
      },
    },
  });

  const badLink = `${origin}/login?error=` + encodeURIComponent('رابط غير صالح أو منتهي — اطلب رابطًا جديدًا');
  // PKCE flow (?code=...) — honors the ?next= chosen by the sender
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(badLink);
  }
  // Email-link flow (?token_hash=...&type=signup|recovery|email_change)
  else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'signup' | 'recovery' | 'email_change' | 'invite',
    });
    if (error) return NextResponse.redirect(badLink);
    // Confirmed identities land on a clear confirmation screen
    if (type === 'signup' || type === 'invite' || type === 'email_change') {
      return NextResponse.redirect(
        `${origin}/login?ok=` + encodeURIComponent('تم تأكيد بريدك بنجاح — سجّل الدخول الآن')
      );
    }
    // Password recovery continues to choosing a new password
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/auth/update-password`);
    }
  } else {
    return NextResponse.redirect(`${origin}/login`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

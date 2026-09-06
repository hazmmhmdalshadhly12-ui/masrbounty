export const runtime = 'edge';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cookieOptions } from '@/lib/supabase/cookies';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const rawNext = searchParams.get('next') ?? '/dashboard';
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('://') && !rawNext.startsWith('/api/')
      ? rawNext
      : '/dashboard';

  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: cookieOptions() as never,
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* ignore */
          }
        },
      },
    }
  );

  const badLink = `${origin}/login?error=` + encodeURIComponent('رابط غير صالح أو منتهي — اطلب رابطًا جديدًا');
  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return NextResponse.redirect(badLink);
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'signup' | 'recovery' | 'email_change' | 'invite',
      });
      if (error) return NextResponse.redirect(badLink);
      if (type === 'signup' || type === 'invite' || type === 'email_change') {
        return NextResponse.redirect(
          `${origin}/login?ok=` + encodeURIComponent('تم تأكيد بريدك بنجاح — سجّل الدخول الآن')
        );
      }
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/update-password`);
      }
    } else {
      return NextResponse.redirect(`${origin}/login`);
    }
  } catch {
    return NextResponse.redirect(badLink);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

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
  const base = cookieOptions();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set(name: string, value: string, options: object) {
          store.set(name, value, { ...base, ...(options as Record<string, unknown>) } as never);
        },
        remove(name: string, options: object) {
          store.set(name, '', { ...base, ...(options as Record<string, unknown>), maxAge: 0 } as never);
        },
      },
    }
  );

  const badLink = `${origin}/login?error=` + encodeURIComponent('رابط غير صالح أو منتهي — اطلب رابطًا جديدًا');
  // PKCE flow (?code=...) — honors the ?next= chosen by the sender
  try {
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
  } catch {
    return NextResponse.redirect(badLink);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

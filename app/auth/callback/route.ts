export const runtime = 'edge';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cookieOptions } from '@/lib/supabase/cookies';
import { recoveryFailureRedirect } from '@/lib/auth/recovery';

/**
 * Auth callback for email links (password recovery, signup, invites).
 *
 * Two link styles are supported:
 *  - PKCE `?code=` links (default when the reset was requested from the
 *    browser client): the code is exchanged server-side using the PKCE code
 *    verifier cookie the requesting browser stored.
 *  - `?token_hash=&type=` links (used by the recovery email template):
 *    verified server-side via verifyOtp — works on any device/browser
 *    because it needs no cookies.
 *
 * Security: the code / token_hash / error_description values are never
 * logged and never echoed into redirect URLs — only a classified,
 * human-readable Arabic message is passed on. Any failure (including a
 * misconfigured environment) fails closed to the login page with a message.
 */
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

  const badLink =
    `${origin}/login?error=` +
    encodeURIComponent('رابط غير صالح أو منتهي — اطلب رابطًا جديدًا');

  // GoTrue may bounce back with error query params (PKCE-style) instead of a
  // code — surface a clear message instead of a silent login redirect.
  if (searchParams.get('error') || searchParams.get('error_code')) {
    return NextResponse.redirect(
      `${origin}${recoveryFailureRedirect({
        errorCode: searchParams.get('error'),
        errorSubCode: searchParams.get('error_code'),
        errorDescription: searchParams.get('error_description'),
      })}`
    );
  }

  try {
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

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(
          `${origin}${recoveryFailureRedirect({ exchangeErrorMessage: error.message })}`
        );
      }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'signup' | 'recovery' | 'email_change' | 'invite',
      });
      if (error) {
        return NextResponse.redirect(
          `${origin}${recoveryFailureRedirect({ exchangeErrorMessage: error.message })}`
        );
      }
      if (type === 'signup' || type === 'invite' || type === 'email_change') {
        return NextResponse.redirect(`${origin}/welcome`);
      }
      if (type === 'recovery') {
        // Recovery session established and persisted in cookies above.
        return NextResponse.redirect(`${origin}/auth/update-password`);
      }
    } else {
      // No usable token in the URL (bare visit or fragment-only errors that
      // never reach the server — the login page resolves those client-side).
      return NextResponse.redirect(badLink);
    }
  } catch {
    // Missing/misconfigured auth env or an unexpected client failure:
    // fail closed with the standard message (nothing about tokens).
    return NextResponse.redirect(badLink);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

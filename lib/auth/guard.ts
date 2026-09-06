import { cookies } from 'next/headers';
import { redirect, forbidden } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export interface GuardUser {
  id: string;
  email?: string;
}

/** Remove stale Supabase auth cookies so the middleware stops bouncing. */
async function clearStaleSessionCookies(): Promise<void> {
  try {
    const store = await cookies();
    for (const c of store.getAll()) {
      if (c.name.includes('-auth-token')) {
        store.set(c.name, '', { path: '/', maxAge: 0 });
      }
    }
  } catch {
    /* ignore */
  }
}

function loginWith(next: string | undefined, error: string): never {
  const back = next ? `?next=${encodeURIComponent(next)}&` : '?';
  redirect(`/login${back}error=` + encodeURIComponent(error));
}

/**
 * Authoritative server-side gate. Every protected layout calls this BEFORE
 * rendering anything (no data reaches unauthenticated users):
 * 1. read + validate session, 2. load user id, 3. check active,
 * 4. optional staff role, 5. allow / redirect / 403.
 * Service outages degrade to a login redirect with a message — never a crash loop.
 */
export async function requireSession(opts?: { roles?: ('admin' | 'moderator')[]; next?: string }): Promise<GuardUser> {
  let userId: string | null = null;
  let email: string | undefined;
  let unreachable = false;
  try {
    const supabase = await createServerClient();
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
      email = data.user?.email ?? undefined;
    } catch {
      unreachable = true;
    }
    if (!userId) {
      if (!unreachable) await clearStaleSessionCookies();
      loginWith(opts?.next, unreachable ? 'تعذر الاتصال بخدمة المصادقة — حاول لاحقًا' : 'سجّل الدخول أولًا للوصول لهذه الصفحة');
    }
    const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', userId as string).single();
    if (profile && profile.is_active === false) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      await clearStaleSessionCookies();
      loginWith(opts?.next, 'تم إيقاف حسابك — يمكنك الاستئناف من صفحة الاستئناف');
    }
    if (opts?.roles?.length) {
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId as string);
      const mine = new Set((roles ?? []).map((r: { role: string }) => r.role));
      if (!opts.roles.some((r) => mine.has(r))) forbidden();
    }
    return { id: userId as string, email };
  } catch (e) {
    if (e instanceof Error && (e.message.includes('NEXT_REDIRECT') || e.message.includes('NEXT_FORBIDDEN'))) throw e;
    loginWith(opts?.next, 'تعذر التحقق من الجلسة — حاول لاحقًا');
  }
}

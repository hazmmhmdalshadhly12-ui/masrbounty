import { cookies } from 'next/headers';
import { redirect, forbidden } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

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

export interface GuardUser {
  id: string;
  email?: string;
}

/**
 * Authoritative server-side gate. Every protected layout calls this BEFORE
 * rendering anything (no data reaches unauthenticated users):
 * 1. read + validate session, 2. load user id, 3. check active,
 * 4. optional staff role, 5. allow / redirect / 403.
 */
export async function requireSession(opts?: { roles?: ('admin' | 'moderator')[]; next?: string }): Promise<GuardUser> {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    // Break the login↔dashboard loop: a stale cookie would make the
    // middleware bounce the user straight back here forever.
    await clearStaleSessionCookies();
    const back = opts?.next ? `?next=${encodeURIComponent(opts.next)}` : '';
    redirect(`/login${back}`);
  }
  const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', data.user.id).single();
  if (profile && profile.is_active === false) {
    await supabase.auth.signOut();
    await clearStaleSessionCookies();
    redirect('/login?error=' + encodeURIComponent('تم إيقاف حسابك — يمكنك الاستئناف من صفحة الاستئناف'));
  }
  if (opts?.roles?.length) {
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id);
    const mine = new Set((roles ?? []).map((r: { role: string }) => r.role));
    if (!opts.roles.some((r) => mine.has(r))) forbidden();
  }
  return { id: data.user.id, email: data.user.email ?? undefined };
}

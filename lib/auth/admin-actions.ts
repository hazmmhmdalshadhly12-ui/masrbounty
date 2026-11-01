import { createServerClient } from '@/lib/supabase/server';

export type StaffRole = 'admin' | 'moderator';

/**
 * Server-side role gate for admin server actions.
 * The /admin layout already blocks non-staff page loads, but every mutating
 * action re-verifies the role here so a stolen session, a stale bundle, or a
 * direct POST can never bypass authorization (never trust the client).
 */
export async function requireStaff(roles: StaffRole[] = ['admin', 'moderator']): Promise<{
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  user: { id: string; email?: string };
}> {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Unauthorized');
  const { data: rolesRows } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', auth.user.id);
  const mine = new Set((rolesRows ?? []).map((r: { role: string }) => r.role));
  if (!roles.some((r) => mine.has(r))) throw new Error('للإدارة فقط');
  return { supabase, user: { id: auth.user.id, email: auth.user.email ?? undefined } };
}

/** Admin-only variant (destructive platform operations). */
export async function requireAdminAction() {
  return requireStaff(['admin']);
}

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server-side self-healing bootstrap (service role, bypasses RLS).
 * Ensures profile/role/researcher rows exist for a confirmed user.
 * Called from dashboard layouts — heals old orphan accounts too.
 * Never throws.
 */
export async function ensureServerBootstrap(
  userId: string,
  meta?: { username?: string; role?: string; email?: string }
): Promise<void> {
  try {
    const db = createAdminClient();
    const rawName = meta?.username || meta?.email?.split('@')[0] || 'user';
    const username = /^[a-zA-Z0-9_]{3,30}$/.test(rawName)
      ? rawName
      : 'user_' + userId.replace(/-/g, '').slice(0, 12);
    const role = meta?.role === 'company' ? 'company' : 'researcher';

    const { data: profile } = await db.from('profiles').select('id').eq('id', userId).single();
    if (!profile) {
      await db.from('profiles').insert({ id: userId, username });
    }

    const { data: roles } = await db.from('user_roles').select('role').eq('user_id', userId).limit(1);
    if (!roles || roles.length === 0) {
      await db.from('user_roles').insert({ user_id: userId, role });
    }

    if (role === 'researcher') {
      const { data: rp } = await db.from('researcher_profiles').select('id').eq('user_id', userId).single();
      if (!rp) {
        // Wallet/reputation/stats rows are auto-created by DB trigger
        await db.from('researcher_profiles').insert({ user_id: userId, display_name: username });
      }
    }
  } catch {
    /* healing must never break page render */
  }
}

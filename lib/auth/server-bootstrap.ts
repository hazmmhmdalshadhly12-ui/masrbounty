import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server-side self-healing bootstrap (service role, bypasses RLS).
 * Ensures profile/role/researcher rows exist for a confirmed user.
 * Called from dashboard layouts — heals old orphan accounts too.
 * Never throws (render must survive healing), but failures are logged and
 * recorded so an account stuck without rows is observable, not silent.
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

    const problems: string[] = [];

    // onConflict keeps the heal idempotent under races with the register flow
    // (duplicate profiles/roles can never be created, even concurrently).
    const { error: profileErr } = await db
      .from('profiles')
      .upsert({ id: userId, username }, { onConflict: 'id', ignoreDuplicates: true });
    if (profileErr) problems.push(`profiles:${profileErr.message}`);

    const { error: roleErr } = await db
      .from('user_roles')
      .upsert({ user_id: userId, role }, { onConflict: 'user_id,role', ignoreDuplicates: true });
    if (roleErr) problems.push(`user_roles:${roleErr.message}`);

    if (role === 'researcher') {
      // Wallet/reputation/stats rows are auto-created by DB trigger
      const { error: rpErr } = await db
        .from('researcher_profiles')
        .upsert(
          { user_id: userId, display_name: username },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
      if (rpErr) problems.push(`researcher_profiles:${rpErr.message}`);
    }

    if (problems.length > 0) {
      // No PII beyond the user id; no tokens/passwords ever reach the log.
      console.error(`[bootstrap] heal incomplete for ${userId}: ${problems.join('; ')}`);
      // Best-effort observability: a security event admins can see. If this
      // fails too (e.g. DB down), console.error above is the remaining signal.
      try {
        await db.from('security_events').insert({
          user_id: userId,
          type: 'bootstrap.incomplete',
          detail: problems.join('; ').slice(0, 500),
        });
      } catch {
        /* already logged to console */
      }
    }
  } catch (e) {
    console.error('[bootstrap] heal failed', e instanceof Error ? e.message : e);
  }
}

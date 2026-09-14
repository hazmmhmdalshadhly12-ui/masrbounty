'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Idempotent bootstrap: guarantees profile/role/researcher rows exist.
 * Called after login AND after register-with-session, so accounts work
 * whether or not email confirmation is enabled. Never throws.
 */
export async function ensureUserBootstrap(
  sb: SupabaseClient,
  userId: string,
  meta?: { username?: string; role?: string; full_name?: string; phone?: string }
): Promise<void> {
  try {
    const username =
      meta?.username && /^[a-zA-Z0-9_]{3,30}$/.test(meta.username)
        ? meta.username
        : 'user_' + userId.replace(/-/g, '').slice(0, 12);
    const role = meta?.role === 'company' ? 'company' : 'researcher';

    const contact: { full_name?: string; phone?: string } = {};
    if (meta?.full_name && meta.full_name.trim().length >= 2) contact.full_name = meta.full_name.trim();
    if (meta?.phone && /^01[0-9]{9}$/.test(meta.phone)) contact.phone = meta.phone;
    const { data: profile } = await sb.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!profile) {
      await sb.from('profiles').insert({ id: userId, username, ...contact });
    } else if (Object.keys(contact).length > 0) {
      await sb.from('profiles').update(contact).eq('id', userId);
    }

    const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', userId).limit(1);
    if (!roles || roles.length === 0) {
      await sb.from('user_roles').insert({ user_id: userId, role });
    }

    if (role === 'researcher') {
      const { data: rp } = await sb
        .from('researcher_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!rp) {
        // Wallet/reputation/stats rows are auto-created by DB trigger
        await sb.from('researcher_profiles').insert({ user_id: userId, display_name: username });
      }
      // Marks email verified only when the JWT itself is confirmed
      await sb.rpc('mark_own_email_verified');
    }
  } catch {
    /* bootstrap must never block auth */
  }
}

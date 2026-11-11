'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Role home for an authenticated user. Order: staff → company → researcher.
 * A company role alone (no rows yet) still lands on /company onboarding.
 */
export async function roleHome(sb: SupabaseClient, userId: string): Promise<string> {
  try {
    const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', userId);
    const mine = new Set((roles ?? []).map((r: { role: string }) => r.role));
    if (mine.has('admin') || mine.has('moderator')) return '/admin';
    if (mine.has('company')) return '/company';
    const [{ data: owned }, { data: member }] = await Promise.all([
      sb.from('company_profiles').select('id').eq('owner_id', userId).limit(1),
      sb.from('company_members').select('id').eq('user_id', userId).limit(1),
    ]);
    if ((owned ?? []).length || (member ?? []).length) return '/company';
    // member accounts land on the memberships dashboard (they may still hold
    // other roles — researcher/company always win above per the platform rules)
    if (mine.has('member') && mine.size === 1) return '/dashboard/member';
  } catch {
    /* fall through to researcher default */
  }
  return '/dashboard';
}

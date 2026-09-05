import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export type NotifyType =
  | 'report'
  | 'comment'
  | 'bounty'
  | 'payment'
  | 'program'
  | 'message'
  | 'system'
  | 'dispute'
  | 'badge';

/**
 * Best-effort in-app notification. Never throws.
 * Authorization is enforced by CALLERS (they resolve recipients from data
 * the caller is allowed to see). The insert itself uses the service role
 * because RLS intentionally forbids users from writing to each other's
 * inboxes — otherwise anyone could spam anyone.
 */
export async function notify(
  _db: SupabaseClient,
  userId: string,
  n: { type: NotifyType; title: string; body?: string; link?: string }
): Promise<void> {
  try {
    if (!userId) return;
    const db = createAdminClient();
    await db.from('notifications').insert({
      user_id: userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
    });
  } catch {
    /* notifications must never break the primary action */
  }
}

/** All researcher user_ids + company member user_ids attached to a report. */
export async function reportParties(
  db: SupabaseClient,
  reportId: string
): Promise<{ reporterUserId: string | null; memberUserIds: string[]; reportNumber: string; programId: string }> {
  const empty = { reporterUserId: null as string | null, memberUserIds: [] as string[], reportNumber: '', programId: '' };
  try {
    const { data: r } = await db
      .from('reports')
      .select('report_number,program_id,researcher_id,researcher_profiles!inner(user_id)')
      .eq('id', reportId)
      .single();
    if (!r) return empty;
    const reporterUserId = (r as unknown as { researcher_profiles: { user_id: string } }).researcher_profiles?.user_id ?? null;
    const { data: prog } = await db.from('programs').select('company_id').eq('id', r.program_id).single();
    let memberUserIds: string[] = [];
    if (prog) {
      const { data: members } = await db.from('company_members').select('user_id').eq('company_id', (prog as { company_id: string }).company_id);
      memberUserIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
    }
    return { reporterUserId, memberUserIds, reportNumber: r.report_number, programId: r.program_id };
  } catch {
    return empty;
  }
}

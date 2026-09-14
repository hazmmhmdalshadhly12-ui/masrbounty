import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify } from '@/lib/notify';

export type ServiceResult<T> = { data: T | null; error: string | null };

export interface Badge {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon: string | null;
  created_at: string;
}

export interface ResearcherBadge {
  id: string;
  researcher_id: string;
  badge_id: string;
  awarded_at: string;
  badges?: Badge | null;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

export async function listBadges(client?: Db): Promise<ServiceResult<Badge[]>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db.from('badges').select('*').order('created_at', { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as Badge[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function getResearcherBadges(
  researcherId: string,
  client?: Db
): Promise<ServiceResult<ResearcherBadge[]>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db
      .from('researcher_badges')
      .select('*,badges(*)')
      .eq('researcher_id', researcherId)
      .order('awarded_at', { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as ResearcherBadge[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Admin-only manual grant. Accepts either a badge id (uuid) or a badge code. */
export async function awardBadge(
  researcherId: string,
  badgeCodeOrId: string,
  client?: Db
): Promise<ServiceResult<ResearcherBadge>> {
  try {
    const db = await getDb(client);
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return { data: null, error: 'Unauthorized' };
    const { data: roles } = await db.from('user_roles').select('role').eq('user_id', auth.user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === 'admin')) {
      return { data: null, error: 'Forbidden: admin only' };
    }
    let badgeId = badgeCodeOrId;
    if (!/^[0-9a-f-]{36}$/i.test(badgeCodeOrId)) {
      const { data: badge } = await db.from('badges').select('id').eq('code', badgeCodeOrId).single();
      if (!badge) return { data: null, error: 'Badge not found' };
      badgeId = (badge as { id: string }).id;
    }
    const { data, error } = await db
      .from('researcher_badges')
      .upsert({ researcher_id: researcherId, badge_id: badgeId }, { onConflict: 'researcher_id,badge_id' })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Award failed' };
    await logAudit('award', 'researcher_badges', (data as ResearcherBadge).id, { researcherId, badgeId }, auth.user.id);
    const { data: rp } = await db.from('researcher_profiles').select('user_id').eq('id', researcherId).single();
    const uid = (rp as { user_id: string } | null)?.user_id;
    if (uid) {
      await notify(db, uid, { type: 'badge', title: `New badge: ${badgeCodeOrId}`, link: '/dashboard/badges' });
    }
    try {
      revalidatePath('/dashboard/badges');
    } catch {
      /* ignore */
    }
    return { data: data as ResearcherBadge, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Re-run the in-DB merit check (first-blood / bug-hunter / critical-hunter). */
export async function checkMeritBadges(
  researcherId: string,
  client?: Db
): Promise<ServiceResult<{ checked: boolean }>> {
  try {
    const db = await getDb(client);
    const { error } = await db.rpc('check_merit_badges', { p_researcher: researcherId });
    if (error) return { data: null, error: error.message };
    return { data: { checked: true }, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function revokeBadge(
  researcherId: string,
  badgeId: string,
  client?: Db
): Promise<ServiceResult<{ researcherId: string; badgeId: string }>> {
  try {
    const db = await getDb(client);
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return { data: null, error: 'Unauthorized' };
    const { data: roles } = await db.from('user_roles').select('role').eq('user_id', auth.user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === 'admin')) {
      return { data: null, error: 'Forbidden: admin only' };
    }
    const { error } = await db
      .from('researcher_badges')
      .delete()
      .eq('researcher_id', researcherId)
      .eq('badge_id', badgeId);
    if (error) return { data: null, error: error.message };
    await logAudit('delete', 'researcher_badges', badgeId, { researcherId }, auth.user.id);
    return { data: { researcherId, badgeId }, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';

export type ServiceResult<T> = { data: T | null; error: string | null };

export interface ModerationAction {
  id: string;
  moderator_id: string;
  target_type: string;
  target_id: string;
  action: string;
  reason: string | null;
  created_at: string;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

async function requireStaff(db: Db): Promise<string> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error('Unauthorized');
  const { data: roles } = await db.from('user_roles').select('role').eq('user_id', auth.user.id);
  const mine = new Set((roles ?? []).map((r: { role: string }) => r.role));
  if (!mine.has('admin') && !mine.has('moderator')) throw new Error('Forbidden: staff only');
  return auth.user.id;
}

/** Staff-only: record a moderation action against any entity. */
export async function createModerationAction(
  targetType: string,
  targetId: string,
  action: string,
  reason?: string | null,
  client?: Db
): Promise<ServiceResult<ModerationAction>> {
  try {
    if (!targetType.trim() || !targetId.trim() || !action.trim()) {
      return { data: null, error: 'target_type, target_id and action are required' };
    }
    const db = await getDb(client);
    const moderatorId = await requireStaff(db);
    const { data, error } = await db
      .from('moderation_actions')
      .insert({
        moderator_id: moderatorId,
        target_type: targetType.trim().slice(0, 80),
        target_id: targetId,
        action: action.trim().slice(0, 80),
        reason: reason?.trim() || null,
      })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Create failed' };
    await logAudit('moderate', targetType, targetId, { action }, moderatorId);
    try {
      revalidatePath('/admin/moderation');
    } catch {
      /* ignore */
    }
    return { data: data as ModerationAction, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function listModerationActions(
  filters?: { targetType?: string; targetId?: string; moderatorId?: string; limit?: number },
  client?: Db
): Promise<ServiceResult<ModerationAction[]>> {
  try {
    const db = await getDb(client);
    let q = db.from('moderation_actions').select('*').order('created_at', { ascending: false });
    if (filters?.targetType) q = q.eq('target_type', filters.targetType);
    if (filters?.targetId) q = q.eq('target_id', filters.targetId);
    if (filters?.moderatorId) q = q.eq('moderator_id', filters.moderatorId);
    if (filters?.limit) q = q.limit(filters.limit);
    const { data, error } = await q;
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as ModerationAction[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

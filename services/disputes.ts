import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify } from '@/lib/notify';

export type ServiceResult<T> = { data: T | null; error: string | null };

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';

export interface Dispute {
  id: string;
  report_id: string;
  opened_by: string;
  reason: string;
  status: DisputeStatus;
  resolved_by: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

async function requireUser(db: Db): Promise<string> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error('Unauthorized');
  return auth.user.id;
}

async function isStaff(db: Db, userId: string): Promise<boolean> {
  const { data: roles } = await db.from('user_roles').select('role').eq('user_id', userId);
  return (roles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'moderator');
}

export async function openDispute(reportId: string, reason: string, client?: Db): Promise<ServiceResult<Dispute>> {
  try {
    if (!reportId) return { data: null, error: 'Report id required' };
    if (reason.trim().length < 10) return { data: null, error: 'Reason must be at least 10 characters' };
    const db = await getDb(client);
    const userId = await requireUser(db);
    const { data: access } = await db.from('reports').select('id').eq('id', reportId).maybeSingle();
    if (!access) return { data: null, error: 'Report not found or not authorized' };
    const { data, error } = await db
      .from('disputes')
      .insert({ report_id: reportId, opened_by: userId, reason: reason.trim(), status: 'open' })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Open failed' };
    await logAudit('create', 'disputes', (data as Dispute).id, { report_id: reportId }, userId);
    try {
      revalidatePath('/admin/disputes');
    } catch {
      /* ignore */
    }
    return { data: data as Dispute, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function listDisputes(
  filters?: { status?: DisputeStatus; reportId?: string; limit?: number },
  client?: Db
): Promise<ServiceResult<Dispute[]>> {
  try {
    const db = await getDb(client);
    let q = db.from('disputes').select('*').order('created_at', { ascending: false });
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.reportId) q = q.eq('report_id', filters.reportId);
    if (filters?.limit) q = q.limit(filters.limit);
    const { data, error } = await q;
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as Dispute[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function getDispute(id: string, client?: Db): Promise<ServiceResult<Dispute>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db.from('disputes').select('*').eq('id', id).single();
    if (error || !data) return { data: null, error: error?.message ?? 'Dispute not found' };
    return { data: data as Dispute, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function addDisputeMessage(
  disputeId: string,
  body: string,
  client?: Db
): Promise<ServiceResult<DisputeMessage>> {
  try {
    const clean = body.trim();
    if (!clean) return { data: null, error: 'Message is empty' };
    if (clean.length > 10000) return { data: null, error: 'Message too long' };
    const db = await getDb(client);
    const userId = await requireUser(db);
    const { data: dispute } = await db.from('disputes').select('id').eq('id', disputeId).maybeSingle();
    if (!dispute) return { data: null, error: 'Dispute not found or not authorized' };
    const { data, error } = await db
      .from('dispute_messages')
      .insert({ dispute_id: disputeId, author_id: userId, body: clean })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Send failed' };
    return { data: data as DisputeMessage, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function listDisputeMessages(
  disputeId: string,
  client?: Db
): Promise<ServiceResult<DisputeMessage[]>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db
      .from('dispute_messages')
      .select('*')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as DisputeMessage[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Staff-only resolution: updates the dispute and records a moderation action. */
export async function resolveDispute(
  disputeId: string,
  status: 'resolved' | 'rejected',
  resolution: string,
  client?: Db
): Promise<ServiceResult<Dispute>> {
  try {
    if (!['resolved', 'rejected'].includes(status)) return { data: null, error: 'Invalid status' };
    const db = await getDb(client);
    const userId = await requireUser(db);
    if (!(await isStaff(db, userId))) return { data: null, error: 'Forbidden: staff only' };
    const { data, error } = await db
      .from('disputes')
      .update({ status, resolution: resolution.trim() || null, resolved_by: userId })
      .eq('id', disputeId)
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Resolve failed' };
    await db.from('moderation_actions').insert({
      moderator_id: userId,
      target_type: 'dispute',
      target_id: disputeId,
      action: status,
      reason: resolution.trim() || null,
    });
    await logAudit('moderate', 'disputes', disputeId, { status }, userId);
    const dispute = data as Dispute;
    await notify(db, dispute.opened_by, {
      type: 'dispute',
      title: status === 'resolved' ? 'Your dispute was resolved' : 'Your dispute was rejected',
      body: resolution.trim() || undefined,
      link: `/dashboard/disputes/${disputeId}`,
    });
    try {
      revalidatePath('/admin/disputes');
    } catch {
      /* ignore */
    }
    return { data: dispute, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

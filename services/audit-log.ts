import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type ServiceResult<T> = { data: T | null; error: string | null };

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'award' | 'payout' | 'moderate' | 'verify';

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: AuditAction;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

/**
 * Write an audit row. Uses the service-role client so logging is never blocked
 * by RLS (audit_logs has no public INSERT policy by design). Never throws —
 * callers use the returned error instead.
 */
export async function writeAuditLog(
  action: AuditAction,
  entity: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
  actorId?: string | null
): Promise<ServiceResult<AuditLog>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from('audit_logs')
      .insert({
        actor_id: actorId ?? null,
        action,
        entity,
        entity_id: entityId ?? null,
        metadata,
      })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Write failed' };
    return { data: data as AuditLog, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Staff-only read (RLS enforces admin/moderator); returns newest first. */
export async function listAuditLogs(
  filters?: { entity?: string; entityId?: string; actorId?: string; limit?: number },
  client?: Db
): Promise<ServiceResult<AuditLog[]>> {
  try {
    const db = await getDb(client);
    let q = db.from('audit_logs').select('*').order('created_at', { ascending: false });
    if (filters?.entity) q = q.eq('entity', filters.entity);
    if (filters?.entityId) q = q.eq('entity_id', filters.entityId);
    if (filters?.actorId) q = q.eq('actor_id', filters.actorId);
    q = q.limit(filters?.limit ?? 100);
    const { data, error } = await q;
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as AuditLog[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

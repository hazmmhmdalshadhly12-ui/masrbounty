import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Central audit log — call from every sensitive Server Action AFTER the write succeeds.
 * Uses the service-role client so logging itself is never blocked by RLS.
 * Never throws: logging must not break the primary operation.
 */
export async function logAudit(
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'award' | 'payout' | 'moderate' | 'verify',
  entity: string,
  entityId?: string,
  meta: Record<string, unknown> = {},
  actorId?: string
): Promise<void> {
  try {
    const db = createAdminClient();
    await db.from('audit_logs').insert({
      actor_id: actorId ?? null,
      action,
      entity,
      entity_id: entityId ?? null,
      metadata: meta,
    });
  } catch {
    /* audit must never break the request */
  }
}

export async function logSecurityEvent(
  type: string,
  detail?: string,
  userId?: string,
  ip?: string
): Promise<void> {
  try {
    const db = createAdminClient();
    await db.from('security_events').insert({ user_id: userId ?? null, type, detail: detail ?? null, ip: ip ?? null });
  } catch {
    /* ignore */
  }
}

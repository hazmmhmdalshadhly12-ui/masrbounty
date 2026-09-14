'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { moderationActionSchema, platformSettingSchema, supportTicketUpdateSchema } from './schemas';

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Unauthorized');
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id);
  const isStaff = (roles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'moderator');
  if (!isStaff) throw new Error('Forbidden: admin access required');
  return { supabase, userId: data.user.id };
}

export async function listAdmin() {
  const { supabase } = await requireAdmin();
  const [{ count: users }, { count: programs }, { count: reports }] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('programs').select('id', { count: 'exact', head: true }),
    supabase.from('reports').select('id', { count: 'exact', head: true }),
  ]);
  const { count: pendingReports } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted');
  const { count: pendingPayouts } = await supabase
    .from('payout_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  const { count: openDisputes } = await supabase
    .from('disputes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');
  return {
    totalUsers: users ?? 0,
    totalPrograms: programs ?? 0,
    totalReports: reports ?? 0,
    pendingReports: pendingReports ?? 0,
    totalPayoutsPending: pendingPayouts ?? 0,
    openDisputes: openDisputes ?? 0,
  };
}

export async function listAuditLogs(limit = 50) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id,actor_id,action,entity,entity_id,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function recordModerationAction(formData: FormData) {
  const parsed = moderationActionSchema.safeParse({
    target_type: formData.get('target_type'),
    target_id: formData.get('target_id'),
    action: formData.get('action'),
    reason: formData.get('reason') || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid moderation action');
  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase.from('moderation_actions').insert({
    moderator_id: userId,
    target_type: parsed.data.target_type,
    target_id: parsed.data.target_id,
    action: parsed.data.action,
    reason: parsed.data.reason ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function updateSupportTicket(formData: FormData) {
  const parsed = supportTicketUpdateSchema.safeParse({
    ticket_id: formData.get('ticket_id'),
    status: formData.get('status'),
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid ticket update');
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from('support_tickets')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.ticket_id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/support');
}

export async function updatePlatformSetting(formData: FormData) {
  let value: unknown = {};
  try {
    value = JSON.parse(String(formData.get('value') ?? '{}'));
  } catch {
    throw new Error('Setting value must be valid JSON');
  }
  const parsed = platformSettingSchema.safeParse({ key: formData.get('key'), value });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid setting');
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key: parsed.data.key, value: parsed.data.value as Record<string, unknown> });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/settings');
}

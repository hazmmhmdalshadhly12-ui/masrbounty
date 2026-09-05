'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { disputeSchema } from '@/schemas/dispute';
import { enforceRate, limits } from '@/lib/rate-limit';
import { logAudit } from '@/services/audit';
import { notify } from '@/lib/notify';

export async function openDisputeAction(formData: FormData) {
  const parsed = disputeSchema.safeParse({ report_id: formData.get('report_id'), reason: formData.get('reason') });
  if (!parsed.success) throw new Error('Invalid dispute');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  enforceRate(`dispute:${user.user.id}`, limits.dispute.max, limits.dispute.windowMs);
  const { error } = await supabase.from('disputes').insert({ report_id: parsed.data.report_id, opened_by: user.user.id, reason: parsed.data.reason });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/disputes');
}

export async function resolveDisputeAction(disputeId: string, formData: FormData) {
  const resolution = String(formData.get('resolution') ?? '');
  const status = String(formData.get('status') ?? 'resolved');
  if (!['resolved', 'rejected'].includes(status)) throw new Error('Invalid status');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await supabase.from('disputes').update({ status, resolution, resolved_by: user.user.id }).eq('id', disputeId);
  await supabase.from('moderation_actions').insert({ moderator_id: user.user.id, target_type: 'dispute', target_id: disputeId, action: status, reason: resolution });
  await logAudit('moderate', 'disputes', disputeId, { status }, user.user.id);
  revalidatePath('/admin/disputes');
}

export async function approvePayoutAction(payoutId: string, approve: boolean) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: payout } = await supabase.from('payout_requests').select('id,researcher_id,amount,status').eq('id', payoutId).single();
  if (!payout) throw new Error('غير موجود');
  // Money moves inside the DB function (admin-only + pending-only enforced there)
  const { error } = await supabase.rpc('settle_payout', { p_payout: payoutId, p_approve: approve });
  if (error) {
    const m = error.message ?? '';
    if (/forbidden/i.test(m)) throw new Error('غير مصرّح لك بهذه العملية');
    if (/already decided/i.test(m)) throw new Error('تم البت في هذا الطلب مسبقًا');
    if (/insufficient/i.test(m)) throw new Error('رصيد الباحث غير كافٍ');
    throw new Error('تعذّر تنفيذ العملية — حاول لاحقًا');
  }
  const { data: rp } = await supabase.from('researcher_profiles').select('user_id').eq('id', payout.researcher_id).single();
  if (rp) {
    await notify(supabase, (rp as { user_id: string }).user_id, {
      type: 'payment',
      title: approve ? `تمت الموافقة على سحب ${payout.amount}` : 'تم رفض طلب السحب',
      body: approve ? 'المبلغ في طريقه إليك حسب وسيلة الدفع' : 'راجع وسيلة الدفع أو تواصل مع الدعم',
      link: '/dashboard/payments',
    });
  }
  revalidatePath('/admin/payments');
}

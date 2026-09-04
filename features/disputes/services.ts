'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { disputeSchema } from '@/schemas/dispute';
import { enforceRate, limits } from '@/lib/rate-limit';
import { logAudit } from '@/services/audit';

export async function openDisputeAction(formData: FormData) {
  const parsed = disputeSchema.safeParse({ report_id: formData.get('report_id'), reason: formData.get('reason') });
  if (!parsed.success) throw new Error('Invalid dispute');
  const supabase = createServerClient();
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
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  await supabase.from('disputes').update({ status, resolution, resolved_by: user.user.id }).eq('id', disputeId);
  await supabase.from('moderation_actions').insert({ moderator_id: user.user.id, target_type: 'dispute', target_id: disputeId, action: status, reason: resolution });
  await logAudit('moderate', 'disputes', disputeId, { status }, user.user.id);
  revalidatePath('/admin/disputes');
}

export async function approvePayoutAction(payoutId: string, approve: boolean) {
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: payout } = await supabase.from('payout_requests').select('*').eq('id', payoutId).single();
  if (!payout) throw new Error('Not found');
  if (approve) {
    const { data: wallet } = await supabase.from('wallets').select('*').eq('researcher_id', payout.researcher_id).single();
    if (!wallet || Number(wallet.balance) < Number(payout.amount)) throw new Error('Insufficient balance');
    const nb = Number(wallet.balance) - Number(payout.amount);
    await supabase.from('wallets').update({ balance: nb }).eq('id', wallet.id);
    await supabase.from('wallet_transactions').insert({ wallet_id: wallet.id, type: 'payout', amount: -Number(payout.amount), balance_after: nb, reference_id: payoutId, note: 'Payout approved' });
    await supabase.from('payout_requests').update({ status: 'completed', reviewed_by: user.user.id }).eq('id', payoutId);
    await logAudit('payout', 'payout_requests', payoutId, { decision: 'completed', amount: payout.amount }, user.user.id);
  } else {
    await supabase.from('payout_requests').update({ status: 'rejected', reviewed_by: user.user.id }).eq('id', payoutId);
    await logAudit('payout', 'payout_requests', payoutId, { decision: 'rejected' }, user.user.id);
  }
  revalidatePath('/admin/payments');
}

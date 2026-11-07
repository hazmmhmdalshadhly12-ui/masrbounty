'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAction } from '@/lib/auth/admin-actions';
import { logAudit } from '@/services/audit';
import { notify, reportParties } from '@/lib/notify';
import { createServerClient } from '@/lib/supabase/server';
import { formatMinor } from '@/lib/finance/money';
import { financeError } from '@/lib/finance/errors';
import {
  commissionRateSchema,
  payoutCompleteSchema,
  payoutFailSchema,
  walletAdjustV2Schema,
} from '@/features/finance/schemas';

const ADMIN_BASE = '/admin/finance';
const COMPANY_BASE = '/company/payments';
const err = (base: string, msg: string) => `${base}?error=` + encodeURIComponent(msg);
const okMsg = (base: string, msg: string) => `${base}?ok=` + encodeURIComponent(msg);

/** Admin verifies the external transfer and credits the wallet EXACTLY ONCE. */
export async function reviewDepositRequestV2Action(requestId: string, approve: boolean, note = '') {
  const { supabase, user } = await requireAdminAction();
  const { error } = await supabase.rpc('review_deposit_request_v2', {
    p_request: requestId,
    p_approve: approve,
    p_note: note || null,
    p_idempotency_key: `deposit-review:${requestId}`,
  });
  if (error) throw new Error(financeError(error));

  // Best-effort notification to company members
  const { data: req } = await supabase
    .from('wallet_deposit_requests')
    .select('company_id,amount_minor')
    .eq('id', requestId)
    .single();
  if (req) {
    const { notifyCompanyMembers } = await import('@/lib/notify');
    await notifyCompanyMembers(supabase, (req as { company_id: string }).company_id, {
      type: 'payment',
      title: approve
        ? `تم اعتماد إيداع ${formatMinor((req as { amount_minor: number }).amount_minor)} EGP — رصيد متاح`
        : 'تم رفض طلب الإيداع — راجع بيانات التحويل',
      link: COMPANY_BASE,
    });
  }
  await logAudit('payout', 'wallet_deposit_requests', requestId, { approve }, user.id);
  revalidatePath(ADMIN_BASE);
  revalidatePath(COMPANY_BASE);
}

/** Set the global commission rate or a company-specific override. */
export async function setCommissionRateAction(formData: FormData) {
  const parsed = commissionRateSchema.safeParse({
    scope: String(formData.get('scope') ?? 'global'),
    company_id: String(formData.get('company_id') ?? '') || null,
    rate_percent: String(formData.get('rate_percent') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  });
  if (!parsed.success) redirect(err(ADMIN_BASE, parsed.error.issues[0]?.message ?? 'بيانات النسبة غير صالحة'));

  const { supabase, user } = await requireAdminAction();
  const { error } = await supabase.rpc('set_commission_rate', {
    p_scope: parsed.data.scope,
    p_company: parsed.data.scope === 'company' ? parsed.data.company_id : null,
    p_rate_bp: parsed.data.rate_percent,
    p_reason: parsed.data.reason,
  });
  if (error) {
    const m = error.message ?? '';
    if (/company required/i.test(m)) redirect(err(ADMIN_BASE, 'اختر الشركة لنسبة خاصة بها'));
    redirect(err(ADMIN_BASE, financeError(error)));
  }
  await logAudit('update', 'commission_settings', undefined, { scope: parsed.data.scope, rate_bp: parsed.data.rate_percent }, user.id);
  revalidatePath(ADMIN_BASE);
  revalidatePath(COMPANY_BASE);
  redirect(okMsg(ADMIN_BASE, 'تم تحديث نسبة العمولة وتسجيلها في السجل'));
}

/** Activate / deactivate a company-specific override. */
export async function toggleCompanyCommissionAction(companyId: string, activate: boolean) {
  const { supabase } = await requireAdminAction();
  const { error } = await supabase.rpc('toggle_company_commission', { p_company: companyId, p_activate: activate });
  if (error) throw new Error(financeError(error));
  revalidatePath(ADMIN_BASE);
  revalidatePath(COMPANY_BASE);
}

/** Move a payout into the processing state (money is NOT moved here). */
export async function startRewardPayoutAction(payoutId: string) {
  const { supabase, user } = await requireAdminAction();
  const { error } = await supabase.rpc('start_reward_payout', { p_payout: payoutId });
  if (error) throw new Error(financeError(error));
  await logAudit('payout', 'researcher_payouts', payoutId, { stage: 'processing' }, user.id);
  revalidatePath(ADMIN_BASE);
}

/**
 * Mark a payout PAID after the external transfer — reserves are released,
 * platform commission recognized, researcher balance credited. A payout can
 * NEVER transition to paid from failed/cancelled (enforced in SQL).
 */
export async function completeRewardPayoutAction(payoutId: string, formData: FormData) {
  const parsed = payoutCompleteSchema.safeParse({
    payout_id: payoutId,
    proof_url: String(formData.get('proof_url') ?? ''),
    reference: String(formData.get('reference') ?? ''),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'بيانات الدفع غير صالحة');

  const { supabase, user } = await requireAdminAction();
  const { error } = await supabase.rpc('complete_reward_payout', {
    p_payout: payoutId,
    p_proof_url: parsed.data.proof_url,
    p_reference: parsed.data.reference || null,
    p_idempotency_key: `payout-complete:${payoutId}`,
  });
  if (error) throw new Error(financeError(error));

  const supabase2 = await createServerClient();
  const { data: payout } = await supabase2
    .from('researcher_payouts')
    .select('researcher_id,reward_id')
    .eq('id', payoutId)
    .single();
  if (payout) {
    const rid = (payout as { researcher_id: string }).researcher_id;
    const { data: rp } = await supabase2.from('researcher_profiles').select('user_id').eq('id', rid).single();
    const uid = (rp as { user_id: string } | null)?.user_id;
    if (uid) {
      await notify(supabase2, uid, {
        type: 'payment',
        title: 'تم صرف المكافأة إلى محفظتك — صارت قابلة للسحب',
        link: '/dashboard/wallet',
      });
    }
  }
  await logAudit('payout', 'researcher_payouts', payoutId, { stage: 'paid' }, user.id);
  revalidatePath(ADMIN_BASE);
  revalidatePath('/dashboard/reports');
}

/** Fail or cancel a payout — the reservation is ALWAYS refunded (in SQL). */
export async function failRewardPayoutAction(payoutId: string, reason: string, cancel = false) {
  const parsed = payoutFailSchema.safeParse({ payout_id: payoutId, reason, cancel });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'بيانات الفشل غير صالحة');
  const { supabase, user } = await requireAdminAction();
  const { error } = await supabase.rpc('fail_reward_payout', {
    p_payout: payoutId,
    p_reason: parsed.data.reason,
    p_cancel: Boolean(parsed.data.cancel),
  });
  if (error) throw new Error(financeError(error));
  await logAudit('payout', 'researcher_payouts', payoutId, { stage: parsed.data.cancel ? 'cancelled' : 'failed' }, user.id);
  revalidatePath(ADMIN_BASE);
  revalidatePath(COMPANY_BASE);
}

/** Admin manual credit/debit against the immutable ledger. */
export async function adjustCompanyWalletV2Action(formData: FormData) {
  const parsed = walletAdjustV2Schema.safeParse({
    company_id: String(formData.get('company_id') ?? ''),
    amount: String(formData.get('amount') ?? ''),
    note: String(formData.get('note') ?? ''),
  });
  if (!parsed.success) redirect(err(ADMIN_BASE, parsed.error.issues[0]?.message ?? 'بيانات التسوية غير صالحة'));

  const { supabase } = await requireAdminAction();
  const { error } = await supabase.rpc('adjust_company_wallet_v2', {
    p_company: parsed.data.company_id,
    p_amount_minor: parsed.data.amount,
    p_note: parsed.data.note,
    p_idempotency_key: `adjust:${parsed.data.company_id}:${crypto.randomUUID()}`,
  });
  if (error) redirect(err(ADMIN_BASE, financeError(error)));
  revalidatePath(ADMIN_BASE);
  redirect(okMsg(ADMIN_BASE, 'تم تنفيذ التسوية وتسجيلها في الدفتر غير القابل للتعديل'));
}

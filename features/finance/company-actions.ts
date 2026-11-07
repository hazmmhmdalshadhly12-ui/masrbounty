'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify, reportParties } from '@/lib/notify';
import { enforceRate, limits } from '@/lib/rate-limit';
import { formatMinor } from '@/lib/finance/money';
import { financeError } from '@/lib/finance/errors';
import {
  depositRequestV2Schema,
  bountyRewardApprovalSchema,
} from '@/features/finance/schemas';

const COMPANY_BASE = '/company/payments';
const err = (base: string, msg: string) => `${base}?error=` + encodeURIComponent(msg);
const okMsg = (base: string, msg: string) => `${base}?ok=` + encodeURIComponent(msg);

const MONEY_RANKS = new Set(['owner', 'admin', 'finance']);

type Sb = Awaited<ReturnType<typeof createServerClient>>;

/** Resolve the caller's company (first membership) + rank, or null. */
async function companyOf(supabase: Sb) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: mem } = await supabase
    .from('company_members')
    .select('company_id,role')
    .eq('user_id', auth.user.id)
    .order('role')
    .limit(1)
    .maybeSingle();
  if (!mem) return null;
  return {
    userId: auth.user.id,
    companyId: (mem as { company_id: string }).company_id,
    role: (mem as { role: string }).role,
  };
}

/**
 * Company files a wallet deposit request (money is credited ONLY after an
 * admin verifies the external transfer — uploading proof never adds credit).
 */
export async function submitDepositRequestAction(formData: FormData) {
  const parsed = depositRequestV2Schema.safeParse({
    amount_minor: String(formData.get('amount') ?? ''),
    method: String(formData.get('method') ?? ''),
    reference: String(formData.get('reference') ?? ''),
    sender_name: String(formData.get('sender_name') ?? ''),
    proof_url: String(formData.get('proof_url') ?? ''),
    note: String(formData.get('note') ?? ''),
  });
  if (!parsed.success) redirect(err(COMPANY_BASE, parsed.error.issues[0]?.message ?? 'بيانات الإيداع غير صالحة'));

  let supabase;
  try {
    supabase = await createServerClient();
  } catch {
    redirect(err(COMPANY_BASE, 'عطل في الاتصال بالخدمة — حاول لاحقًا'));
  }
  const ctx = await companyOf(supabase);
  if (!ctx) redirect(err(COMPANY_BASE, 'لا يوجد ملف شركة مرتبط بحسابك'));
  if (!MONEY_RANKS.has(ctx.role)) redirect(err(COMPANY_BASE, 'دور المشاهد لا يملك صلاحية طلب الإيداع'));
  try {
    enforceRate(`deposit2:${ctx.userId}`, limits.payout.max, limits.payout.windowMs);
  } catch {
    redirect(err(COMPANY_BASE, 'طلبات كثيرة — انتظر قليلًا وحاول مجددًا'));
  }

  const { error } = await supabase.from('wallet_deposit_requests').insert({
    company_id: ctx.companyId,
    amount_minor: parsed.data.amount_minor,
    method: parsed.data.method,
    reference: parsed.data.reference,
    sender_name: parsed.data.sender_name || null,
    proof_url: parsed.data.proof_url || null,
    note: parsed.data.note || null,
    status: 'pending',
  });
  if (error) redirect(err(COMPANY_BASE, 'تعذر إرسال طلب الإيداع — تأكد من البيانات وحاول لاحقًا'));

  revalidatePath(COMPANY_BASE);
  revalidatePath('/admin/finance');
  redirect(okMsg(COMPANY_BASE, 'تم إرسال طلب الإيداع — يُضاف الرصيد فقط بعد اعتماد الإدارة للتحويل'));
}

/**
 * Approve a bounty reward: server-side explicit confirmation, balance check,
 * reservation of (reward + LOCKED commission) inside the SQL RPC.
 */
export async function approveBountyRewardAction(reportId: string, formData: FormData) {
  const parsed = bountyRewardApprovalSchema.safeParse({
    report_id: reportId,
    amount_minor: String(formData.get('amount') ?? ''),
    confirm: formData.get('confirm') === 'on' || formData.get('confirm') === 'true',
    idempotency_key: String(formData.get('idempotency_key') ?? '') || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'بيانات المكافأة غير صالحة');

  const supabase = await createServerClient();
  const { data: rep0 } = await supabase.from('reports').select('program_id').eq('id', reportId).single();
  if (!rep0) throw new Error('التقرير غير موجود');
  // Membership gate mirrors the RPC (which re-verifies with row locks anyway)
  const { data: program } = await supabase.from('programs').select('company_id').eq('id', (rep0 as { program_id: string }).program_id).single();
  const companyId = (program as { company_id: string } | null)?.company_id;
  if (companyId) {
    const { data: mem } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .maybeSingle();
    if (!mem || !MONEY_RANKS.has((mem as { role: string }).role)) throw new Error('غير مصرّح لك بهذه العملية');
  }

  const { error } = await supabase.rpc('approve_bounty_reward', {
    p_report: reportId,
    p_reward_amount_minor: parsed.data.amount_minor,
    p_confirm: true,
    p_idempotency_key: parsed.data.idempotency_key ?? `reward:${reportId}:${crypto.randomUUID()}`,
  });
  if (error) throw new Error(financeError(error));

  const parties = await reportParties(supabase, reportId);
  if (parties.reporterUserId) {
    await notify(supabase, parties.reporterUserId, {
      type: 'bounty',
      title: 'مكافأة معتمدة على تقريرك — بانتظار الصرف',
      body: `القيمة: ${formatMinor(parsed.data.amount_minor)} EGP`,
      link: `/dashboard/reports/${reportId}`,
    });
  }
  await logAudit('award', 'bounty_rewards', reportId, { amount_minor: parsed.data.amount_minor });
  revalidatePath(`/company/reports/${reportId}`);
  revalidatePath(COMPANY_BASE);
}

/** Retry a payout after failure/cancellation — re-reserves the LOCKED total. */
export async function retryRewardPayoutAction(rewardId: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc('retry_reward_payout', { p_reward: rewardId });
  if (error) throw new Error(financeError(error));
  revalidatePath('/company/payments');
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdminAction } from '@/lib/auth/admin-actions';
import { notifyCompanyMembers } from '@/lib/notify';
import { enforceRate, limits } from '@/lib/rate-limit';
import { depositSchema, adjustSchema } from '@/schemas/wallet';

const COMPANY_BASE = '/company/payments';
const ADMIN_BASE = '/admin/payments';
const err = (base: string, msg: string) => `${base}?error=` + encodeURIComponent(msg);
const okMsg = (base: string, msg: string) => `${base}?ok=` + encodeURIComponent(msg);

const MONEY_RANKS = new Set(['owner', 'admin', 'finance']);

/** Resolve the caller's company (first membership) + rank, or null. */
async function companyOf(supabase: Awaited<ReturnType<typeof createServerClient>>) {
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

/** Company money desk files a deposit request after transferring to the platform. */
export async function requestDepositAction(formData: FormData) {
  const parsed = depositSchema.safeParse({
    amount: Number(formData.get('amount')),
    method: String(formData.get('method') ?? ''),
    reference: String(formData.get('reference') ?? ''),
    sender_name: String(formData.get('sender_name') ?? ''),
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
    enforceRate(`deposit:${ctx.userId}`, limits.payout.max, limits.payout.windowMs);
  } catch {
    redirect(err(COMPANY_BASE, 'طلبات كثيرة — انتظر قليلًا وحاول مجددًا'));
  }
  const { error } = await supabase.from('deposit_requests').insert({
    company_id: ctx.companyId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference: parsed.data.reference,
    sender_name: parsed.data.sender_name || null,
    note: parsed.data.note || null,
    status: 'pending',
  });
  if (error) redirect(err(COMPANY_BASE, 'تعذر إرسال طلب الإيداع — تأكد من البيانات وحاول لاحقًا'));
  revalidatePath(COMPANY_BASE);
  revalidatePath(ADMIN_BASE);
  redirect(okMsg(COMPANY_BASE, 'تم إرسال طلب الإيداع — سيُعتمد بعد التحقق من التحويل'));
}

/** Admin verifies the external transfer and credits the company wallet. */
export async function reviewDepositAction(depositId: string, approve: boolean) {
  const { supabase } = await requireAdminAction();
  const { data: dep } = await supabase
    .from('deposit_requests')
    .select('id,company_id,amount,status')
    .eq('id', depositId)
    .single();
  if (!dep) throw new Error('طلب الإيداع غير موجود');
  const { error } = await supabase.rpc('review_deposit', { p_deposit: depositId, p_approve: approve, p_note: null });
  if (error) {
    const m = error.message ?? '';
    if (/forbidden/i.test(m)) throw new Error('غير مصرّح لك بهذه العملية');
    if (/already decided/i.test(m)) throw new Error('تم البت في هذا الطلب مسبقًا');
    throw new Error('تعذر تنفيذ العملية — حاول لاحقًا');
  }
  await notifyCompanyMembers(supabase, (dep as { company_id: string }).company_id, {
    type: 'payment',
    title: approve
      ? `تم اعتماد إيداع ${(dep as { amount: number }).amount} EGP — رصيد محفظتك اتحدّث`
      : 'تم رفض طلب الإيداع — راجع بيانات التحويل',
    link: '/company/payments',
  });
  revalidatePath(ADMIN_BASE);
  revalidatePath(COMPANY_BASE);
}

/** Admin manual credit/debit on any wallet (full control + audit note). */
export async function adjustWalletAction(formData: FormData) {
  const parsed = adjustSchema.safeParse({
    subject: String(formData.get('subject') ?? ''),
    id: String(formData.get('id') ?? ''),
    amount: Number(formData.get('amount')),
    note: String(formData.get('note') ?? ''),
  });
  if (!parsed.success) redirect(err(ADMIN_BASE, parsed.error.issues[0]?.message ?? 'بيانات التسوية غير صالحة'));

  const { supabase } = await requireAdminAction();
  const { error } = await supabase.rpc('adjust_wallet', {
    p_subject: parsed.data.subject,
    p_id: parsed.data.id,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note,
  });
  if (error) {
    const m = error.message ?? '';
    if (/insufficient/.test(m)) redirect(err(ADMIN_BASE, 'الرصيد لا يكفي لخصم هذا المبلغ'));
    if (/not found/.test(m)) redirect(err(ADMIN_BASE, 'المحفظة أو الملف غير موجود'));
    redirect(err(ADMIN_BASE, 'تعذر تنفيذ التسوية — تأكد من المعرّف وحاول لاحقًا'));
  }
  revalidatePath(ADMIN_BASE);
  redirect(okMsg(ADMIN_BASE, 'تم تنفيذ التسوية وتسجيلها في دفتر التحولات'));
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { payoutSchema } from '@/schemas/wallet';
import { enforceRate, limits } from '@/lib/rate-limit';

const BASE = '/dashboard/wallet';
const err = (msg: string) => `${BASE}?error=` + encodeURIComponent(msg);

export async function requestPayoutAction(formData: FormData) {
  try {
    const parsed = payoutSchema.safeParse({
      amount: Number(formData.get('amount')),
      payment_method_id: formData.get('payment_method_id'),
    });
    if (!parsed.success) redirect(err('طلب سحب غير صالح'));

    let supabase;
    try {
      supabase = await createServerClient();
    } catch {
      redirect(err('عطل في الاتصال بالخدمة — حاول لاحقًا'));
    }
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) redirect(err('سجّل الدخول أولًا'));
    try {
      enforceRate(`payout:${user.user.id}`, limits.payout.max, limits.payout.windowMs);
    } catch {
      redirect(err('طلبات كثيرة — انتظر قليلًا وحاول مجددًا'));
    }
    const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
    if (!rp) redirect(err('لا يوجد ملف باحث'));
    const { data: wallet } = await supabase.from('wallets').select('balance').eq('researcher_id', rp.id).single();
    if (!wallet || Number(wallet.balance) < parsed.data.amount) redirect(err('الرصيد غير كافٍ'));
    const { error } = await supabase.from('payout_requests').insert({
      researcher_id: rp.id,
      amount: parsed.data.amount,
      payment_method_id: parsed.data.payment_method_id,
      status: 'pending',
    });
    if (error) redirect(err('تعذر إرسال الطلب — حاول لاحقًا'));
    revalidatePath(BASE);
  } catch (e) {
    if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e;
    redirect(err('تعذر إرسال الطلب — حاول لاحقًا'));
  }
  redirect(`${BASE}?ok=` + encodeURIComponent('تم إرسال طلب السحب للمراجعة'));
}

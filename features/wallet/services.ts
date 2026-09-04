'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { payoutSchema } from '@/schemas/wallet';

export async function requestPayoutAction(formData: FormData) {
  const parsed = payoutSchema.safeParse({
    amount: Number(formData.get('amount')),
    payment_method_id: formData.get('payment_method_id'),
  });
  if (!parsed.success) throw new Error('Invalid payout request');
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) throw new Error('No researcher profile');
  const { data: wallet } = await supabase.from('wallets').select('balance').eq('researcher_id', rp.id).single();
  if (!wallet || Number(wallet.balance) < parsed.data.amount) throw new Error('Insufficient balance');
  const { error } = await supabase.from('payout_requests').insert({
    researcher_id: rp.id,
    amount: parsed.data.amount,
    payment_method_id: parsed.data.payment_method_id,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/wallet');
}

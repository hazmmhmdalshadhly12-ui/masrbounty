'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';

async function companyOfProgram(programId: string) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: program } = await supabase.from('programs').select('id,company_id').eq('id', programId).single();
  if (!program) throw new Error('Program not found');
  const { data: member } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', program.company_id)
    .eq('user_id', user.user.id)
    .single();
  if (!member) throw new Error('Not a company member');
  return { supabase, program };
}

export async function triageReportAction(reportId: string, status: string) {
  const allowed = ['triaged', 'informative', 'duplicate', 'not_applicable', 'accepted', 'resolved', 'closed'];
  if (!allowed.includes(status)) throw new Error('Invalid status');
  const supabase = await createServerClient();
  const { data: report } = await supabase.from('reports').select('program_id').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  await companyOfProgram(report.program_id);
  const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
  if (error) throw new Error(error.message);
  await logAudit('update', 'reports', reportId, { status }, (await supabase.auth.getUser()).data.user?.id);
  revalidatePath('/company/reports');
}

export async function awardBountyAction(reportId: string, formData: FormData) {
  const amount = Number(formData.get('amount'));
  if (!amount || amount < 0) throw new Error('Invalid amount');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: report } = await supabase.from('reports').select('id,program_id,researcher_id').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  await companyOfProgram(report.program_id);
  // Server-side: create award + credit wallet atomically via wallet update + txn
  const { data: award, error: aErr } = await supabase
    .from('bounty_awards')
    .upsert({ report_id: reportId, amount, status: 'approved', awarded_by: user.user.id }, { onConflict: 'report_id' })
    .select('id')
    .single();
  if (aErr || !award) throw new Error(aErr?.message ?? 'Award failed');
  const { data: wallet } = await supabase.from('wallets').select('*').eq('researcher_id', report.researcher_id).single();
  if (!wallet) throw new Error('Wallet not found');
  const newBalance = Number(wallet.balance) + amount;
  const newEarned = Number(wallet.total_earned) + amount;
  await supabase.from('wallets').update({ balance: newBalance, total_earned: newEarned }).eq('id', wallet.id);
  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id, type: 'bounty', amount, balance_after: newBalance, reference_id: reportId, note: 'Bounty awarded',
  });
  await supabase.from('reports').update({ status: 'accepted', bounty_amount: amount }).eq('id', reportId);
  await logAudit('award', 'bounty_awards', award.id, { report_id: reportId, amount }, user.user.id);
  revalidatePath(`/company/reports/${reportId}`);
}

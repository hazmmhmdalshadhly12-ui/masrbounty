'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify, reportParties } from '@/lib/notify';

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
  const actor = (await supabase.auth.getUser()).data.user?.id;
  await logAudit('update', 'reports', reportId, { status }, actor);
  const parties = await reportParties(supabase, reportId);
  if (parties.reporterUserId) {
    await notify(supabase, parties.reporterUserId, {
      type: 'report',
      title: `تحديث التقرير ${parties.reportNumber}: ${status}`,
      body: 'غيّرت الشركة حالة تقريرك — افتحه لعرض التفاصيل',
      link: `/dashboard/reports/${reportId}`,
    });
  }
  revalidatePath('/company/reports');
}

export async function changeSeverityAction(reportId: string, formData: FormData) {
  const severity = String(formData.get('severity') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const allowed = ['informational', 'low', 'medium', 'high', 'critical'];
  if (!allowed.includes(severity)) throw new Error('Invalid severity');
  if (reason.length < 5) throw new Error('Reason required (5+ chars)');
  const supabase = await createServerClient();
  const { data: report } = await supabase.from('reports').select('program_id,severity').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  await companyOfProgram(report.program_id);
  const { error } = await supabase.from('reports').update({ severity }).eq('id', reportId);
  if (error) throw new Error(error.message);
  const actor = (await supabase.auth.getUser()).data.user?.id;
  // Reason is preserved permanently on the timeline
  await supabase.from('report_events').insert({
    report_id: reportId,
    actor_id: actor ?? null,
    note: `Severity changed ${report.severity} → ${severity}. Reason: ${reason}`,
  });
  await logAudit('update', 'reports', reportId, { severity, reason }, actor);
  const parties = await reportParties(supabase, reportId);
  if (parties.reporterUserId) {
    await notify(supabase, parties.reporterUserId, {
      type: 'report',
      title: `تغيّرت خطورة التقرير ${parties.reportNumber} إلى ${severity}`,
      body: reason,
      link: `/dashboard/reports/${reportId}`,
    });
  }
  revalidatePath(`/company/reports/${reportId}`);
}

export async function markDuplicateAction(reportId: string, formData: FormData) {
  const duplicateOf = String(formData.get('duplicate_of') ?? '').trim();
  if (!duplicateOf) throw new Error('Original report id/number required');
  const supabase = await createServerClient();
  const { data: report } = await supabase.from('reports').select('program_id').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  await companyOfProgram(report.program_id);
  // Accept either UUID or MB-000001 number for the original
  let originalId = duplicateOf;
  if (!/^[0-9a-f-]{36}$/i.test(duplicateOf)) {
    const { data: orig } = await supabase.from('reports').select('id').eq('report_number', duplicateOf.toUpperCase()).single();
    if (!orig) throw new Error('Original report not found');
    originalId = orig.id;
  }
  if (originalId === reportId) throw new Error('A report cannot duplicate itself');
  await supabase.from('report_duplicates').insert({ report_id: reportId, duplicate_of: originalId, marked_by: (await supabase.auth.getUser()).data.user?.id ?? null });
  await supabase.from('reports').update({ status: 'duplicate' }).eq('id', reportId);
  const parties = await reportParties(supabase, reportId);
  if (parties.reporterUserId) {
    await notify(supabase, parties.reporterUserId, {
      type: 'report',
      title: `التقرير ${parties.reportNumber} حُدد كمكرر`,
      link: `/dashboard/reports/${reportId}`,
    });
  }
  revalidatePath(`/company/reports/${reportId}`);
}

export async function markPaidAction(awardId: string, formData: FormData) {
  const reference = String(formData.get('reference') ?? '').trim().slice(0, 120);
  if (!reference) throw new Error('Payment reference required');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: award } = await supabase
    .from('bounty_awards')
    .select('id,amount,status,report_id,reports!inner(program_id,researcher_id)')
    .eq('id', awardId)
    .single();
  if (!award) throw new Error('Award not found');
  const programId = (award as unknown as { reports: { program_id: string } }).reports.program_id;
  await companyOfProgram(programId);
  if (award.status === 'paid') throw new Error('Already paid');
  await supabase.from('bounty_awards').update({ status: 'paid', decided_at: new Date().toISOString() }).eq('id', awardId);
  await supabase.from('bounty_payments').insert({
    award_id: awardId,
    amount: award.amount,
    status: 'completed',
    reference,
    processed_by: user.user.id,
  });
  // Move from pending to available balance
  const researcherId = (award as unknown as { reports: { researcher_id: string } }).reports.researcher_id;
  const { data: wallet } = await supabase.from('wallets').select('*').eq('researcher_id', researcherId).single();
  if (wallet) {
    const nb = Number(wallet.balance) + Number(award.amount);
    await supabase.from('wallets').update({
      balance: nb,
      pending_balance: Math.max(0, Number(wallet.pending_balance) - Number(award.amount)),
    }).eq('id', wallet.id);
    await supabase.from('wallet_transactions').insert({
      wallet_id: wallet.id, type: 'bounty', amount: Number(award.amount), balance_after: nb, reference_id: awardId, note: `Bounty paid (ref ${reference})`,
    });
  }
  const parties = await reportParties(supabase, award.report_id);
  if (parties.reporterUserId) {
    await notify(supabase, parties.reporterUserId, {
      type: 'payment',
      title: `تم دفع مكافأة ${award.amount} — مرجع ${reference}`,
      link: '/dashboard/payments',
    });
  }
  revalidatePath('/company/payments');
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
  // Idempotency: never credit the same report twice (double-submit safe)
  const { data: existing } = await supabase.from('bounty_awards').select('id,status').eq('report_id', reportId).single();
  if (existing && (existing.status === 'approved' || existing.status === 'paid')) {
    throw new Error('Bounty already awarded for this report');
  }
  // Server-side: create award + credit wallet via wallet update + txn
  const { data: award, error: aErr } = await supabase
    .from('bounty_awards')
    .upsert({ report_id: reportId, amount, status: 'approved', awarded_by: user.user.id }, { onConflict: 'report_id' })
    .select('id')
    .single();
  if (aErr || !award) throw new Error(aErr?.message ?? 'Award failed');
  const { data: wallet } = await supabase.from('wallets').select('*').eq('researcher_id', report.researcher_id).single();
  if (!wallet) throw new Error('Wallet not found');
  // Approved bounty lands in PENDING until the company marks it paid
  const newPending = Number(wallet.pending_balance) + amount;
  const newEarned = Number(wallet.total_earned) + amount;
  await supabase.from('wallets').update({ pending_balance: newPending, total_earned: newEarned }).eq('id', wallet.id);
  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id, type: 'bounty', amount, balance_after: Number(wallet.balance), reference_id: reportId, note: 'Bounty approved (pending payment)',
  });
  await supabase.from('reports').update({ status: 'accepted', bounty_amount: amount }).eq('id', reportId);
  await logAudit('award', 'bounty_awards', award.id, { report_id: reportId, amount }, user.user.id);
  const parties = await reportParties(supabase, reportId);
  if (parties.reporterUserId) {
    await notify(supabase, parties.reporterUserId, {
      type: 'bounty',
      title: `مكافأة ${amount} على التقرير ${parties.reportNumber}`,
      link: '/dashboard/payments',
    });
  }
  revalidatePath(`/company/reports/${reportId}`);
}

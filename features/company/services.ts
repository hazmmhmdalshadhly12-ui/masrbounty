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

function moneyError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : 'failed';
  if (/unauthorized/i.test(msg)) return new Error('سجّل الدخول أولًا');
  if (/forbidden/i.test(msg)) return new Error('غير مصرّح لك بهذه العملية');
  if (/already awarded|already paid|already decided/i.test(msg)) return new Error('تم تنفيذ هذه العملية مسبقًا');
  if (/insufficient balance/i.test(msg)) return new Error('الرصيد غير كافٍ');
  if (/reference required/i.test(msg)) return new Error('مرجع الدفع مطلوب');
  if (/invalid amount/i.test(msg)) return new Error('مبلغ غير صالح');
  if (/not found/i.test(msg)) return new Error('غير موجود');
  return new Error('تعذّر تنفيذ العملية — حاول لاحقًا');
}

export async function markPaidAction(awardId: string, formData: FormData) {
  const reference = String(formData.get('reference') ?? '').trim().slice(0, 120);
  const supabase = await createServerClient();
  const { data: award } = await supabase.from('bounty_awards').select('id,amount,report_id').eq('id', awardId).single();
  // Money moves inside the DB function (membership + idempotency enforced there)
  const { error } = await supabase.rpc('pay_award', { p_award: awardId, p_reference: reference || 'manual' });
  if (error) throw moneyError(error);
  const parties = award ? await reportParties(supabase, award.report_id) : { reporterUserId: null as string | null };
  if (parties.reporterUserId) {
    await notify(supabase, parties.reporterUserId, {
      type: 'payment',
      title: `تم دفع المكافأة — مرجع ${reference || 'manual'}`,
      link: '/dashboard/payments',
    });
  }
  revalidatePath('/company/payments');
}

export async function awardBountyAction(reportId: string, formData: FormData) {
  const amount = Number(formData.get('amount'));
  const supabase = await createServerClient();
  // Money moves inside the DB function (membership + idempotency enforced there)
  const { data: awardId, error } = await supabase.rpc('award_bounty', { p_report: reportId, p_amount: amount });
  if (error || !awardId) throw moneyError(error);
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

'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify, reportParties } from '@/lib/notify';
import { enforceRate } from '@/lib/rate-limit';
import {
  canTransition,
  COMPANY_TRIAGE_STATUSES,
  REASON_REQUIRED_STATUSES,
  REPORT_STATUS_LABELS,
  type ReportStatus,
} from '@/constants/statuses';

type MemberRole = 'owner' | 'admin' | 'triager' | 'viewer';

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
  return { supabase, program, role: (member as { role: MemberRole }).role };
}

/**
 * Mutating company operations require owner/admin/triager.
 * Viewers are strictly read-only (a viewer JWT must never change state,
 * even if RLS would technically permit a member write).
 */
export async function requireCompanyRole(programId: string, allowed: MemberRole[] = ['owner', 'admin', 'triager']) {
  const ctx = await companyOfProgram(programId);
  if (!allowed.includes(ctx.role)) throw new Error('غير مصرّح لك بهذه العملية (دور المشاهد للقراءة فقط)');
  return ctx;
}

/**
 * Company triage with lifecycle enforcement:
 *  - only company-controlled statuses (finance states are set by money RPCs);
 *  - from → to must respect the canonical transition map (DB trigger
 *    `fn_enforce_report_transitions` enforces the same rules again);
 *  - decision statuses (rejected/duplicate/not_applicable/spam) REQUIRE a
 *    written reason, stored permanently on the report timeline.
 */
export async function triageReportAction(reportId: string, formData: FormData) {
  const status = String(formData?.get('status') ?? '').trim();
  const reason = String(formData?.get('reason') ?? '').trim().slice(0, 1000);
  if (!(COMPANY_TRIAGE_STATUSES as readonly string[]).includes(status)) {
    throw new Error('حالة غير متاحة للشركة');
  }
  const supabase = await createServerClient();
  const { data: report } = await supabase
    .from('reports')
    .select('program_id,status,report_number')
    .eq('id', reportId)
    .single();
  if (!report) throw new Error('Not found');
  const fromStatus = (report as unknown as { status: string }).status;
  if (!canTransition(fromStatus, status)) {
    throw new Error(
      `انتقال غير صالح: ${REPORT_STATUS_LABELS[fromStatus as ReportStatus]?.ar ?? fromStatus} ← ${REPORT_STATUS_LABELS[status as ReportStatus]?.ar ?? status}`
    );
  }
  if ((REASON_REQUIRED_STATUSES as readonly string[]).includes(status) && reason.length < 5) {
    throw new Error('سبب القرار مطلوب (5 أحرف على الأقل) — يُحفظ في سجل التقرير');
  }
  await requireCompanyRole(report.program_id);
  const { data: actor } = await supabase.auth.getUser();
  if (actor.user) enforceRate(`triage:${actor.user.id}`, 60, 60_000);
  const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
  if (error) throw friendlyTriageError(error.message);
  // Decision reason is preserved permanently on the timeline as its own
  // note event (the status change itself is auto-logged by the DB trigger).
  // A failed insert must NEVER be silent — the UI promises the reason is
  // stored, so losing it quietly would break the decision audit trail.
  if (reason) {
    const { error: evErr } = await supabase.from('report_events').insert({
      report_id: reportId,
      actor_id: actor.user?.id ?? null,
      note: `سبب القرار (${REPORT_STATUS_LABELS[status as ReportStatus]?.ar ?? status}): ${reason}`,
    });
    if (evErr) throw new Error(`تم تحديث الحالة لكن تعذّر حفظ سبب القرار: ${evErr.message}`);
  }
  if (status === 'resolved') {
    const { data: rr } = await supabase.from('reports').select('researcher_id').eq('id', reportId).single();
    const rid = (rr as unknown as { researcher_id: string } | null)?.researcher_id;
    if (rid) {
      await supabase.rpc('refresh_researcher_stats', { p_researcher: rid });
      await supabase.rpc('check_merit_badges', { p_researcher: rid });
    }
  }
  await logAudit('update', 'reports', reportId, { status, reason: reason || null }, actor.user?.id);
  const parties = await reportParties(supabase, reportId);
  if (parties.reporterUserId) {
    const arLabel = REPORT_STATUS_LABELS[status as ReportStatus]?.ar ?? status;
    await notify(supabase, parties.reporterUserId, {
      type: 'report',
      title: `تحديث التقرير ${parties.reportNumber}: ${arLabel}`,
      body: reason || 'غيّرت الشركة حالة تقريرك — افتحه لعرض التفاصيل',
      link: `/dashboard/reports/${reportId}`,
    });
  }
  revalidatePath('/company/reports');
  revalidatePath(`/company/reports/${reportId}`);
}

function friendlyTriageError(raw: string): Error {
  if (/invalid transition/i.test(raw)) return new Error('انتقال حالة غير صالح وفق دورة حياة التقرير');
  if (/forbidden/i.test(raw)) return new Error('غير مصرّح لك بهذه العملية');
  return new Error(raw || 'تعذّر تحديث الحالة');
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
  await requireCompanyRole(report.program_id);
  const { error } = await supabase.from('reports').update({ severity }).eq('id', reportId);
  if (error) throw new Error(error.message);
  const actor = (await supabase.auth.getUser()).data.user?.id;
  // Reason is preserved permanently on the timeline (fail loudly — never silent)
  const { error: evErr } = await supabase.from('report_events').insert({
    report_id: reportId,
    actor_id: actor ?? null,
    note: `Severity changed ${report.severity} → ${severity}. Reason: ${reason}`,
  });
  if (evErr) throw new Error(`تم تحديث الخطورة لكن تعذّر حفظ السبب: ${evErr.message}`);
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
  const { data: report } = await supabase.from('reports').select('program_id,status').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  await requireCompanyRole(report.program_id);
  // Lifecycle guard: 'duplicate' is reachable only from pre-decision states.
  // Without this check the DB trigger (migration 27) would raise a raw
  // "invalid transition" — and if the migration is not applied yet the
  // update would silently succeed and lie to the researcher.
  const fromStatus = (report as unknown as { status: string }).status;
  if (!canTransition(fromStatus, 'duplicate')) {
    throw new Error(
      `انتقال غير صالح: ${REPORT_STATUS_LABELS[fromStatus as ReportStatus]?.ar ?? fromStatus} ← مكرر — القرار النهائي لا يُعاد فتحه من هنا`
    );
  }
  // Accept either UUID or MB-000001 number for the original
  let originalId = duplicateOf;
  if (!/^[0-9a-f-]{36}$/i.test(duplicateOf)) {
    const { data: orig } = await supabase.from('reports').select('id').eq('report_number', duplicateOf.toUpperCase()).single();
    if (!orig) throw new Error('Original report not found');
    originalId = orig.id;
  }
  if (originalId === reportId) throw new Error('A report cannot duplicate itself');
  await supabase.from('report_duplicates').insert({ report_id: reportId, duplicate_of: originalId, marked_by: (await supabase.auth.getUser()).data.user?.id ?? null });
  const { error } = await supabase.from('reports').update({ status: 'duplicate' }).eq('id', reportId);
  if (error) throw friendlyTriageError(error.message);
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

export async function assignReportAction(reportId: string, formData: FormData) {
  const assigneeId = String(formData.get('assignee_id') ?? '');
  if (!assigneeId) throw new Error('اختر عضوًا');
  const supabase = await createServerClient();
  const { data: report } = await supabase.from('reports').select('program_id').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  const { program } = await requireCompanyRole(report.program_id);
  const { data: member } = await supabase.from('company_members').select('user_id').eq('company_id', program.company_id).eq('user_id', assigneeId).single();
  if (!member) throw new Error('Not a team member');
  const { data: me } = await supabase.auth.getUser();
  await supabase.from('report_assignees').upsert(
    { report_id: reportId, user_id: assigneeId, assigned_by: me.user?.id ?? null },
    { onConflict: 'report_id,user_id' }
  );
  revalidatePath(`/company/reports/${reportId}`);
}

export async function unassignReportAction(reportId: string, userId: string) {
  const supabase = await createServerClient();
  const { data: report } = await supabase.from('reports').select('program_id').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  await requireCompanyRole(report.program_id);
  await supabase.from('report_assignees').delete().eq('report_id', reportId).eq('user_id', userId);
  revalidatePath(`/company/reports/${reportId}`);
}

export async function toggleLabelAction(reportId: string, formData: FormData) {
  const labelId = String(formData.get('label_id') ?? '');
  if (!labelId) throw new Error('اختر وسمًا');
  const supabase = await createServerClient();
  const { data: report } = await supabase.from('reports').select('program_id').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  await requireCompanyRole(report.program_id);
  const { data: existing } = await supabase.from('report_label_links').select('label_id').eq('report_id', reportId).eq('label_id', labelId).single();
  if (existing) {
    await supabase.from('report_label_links').delete().eq('report_id', reportId).eq('label_id', labelId);
  } else {
    await supabase.from('report_label_links').insert({ report_id: reportId, label_id: labelId });
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
  if (award) {
    const { data: rep } = await supabase.from('reports').select('program_id').eq('id', award.report_id).single();
    if (rep) await requireCompanyRole(rep.program_id);
  }
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
  const { data: rep0 } = await supabase.from('reports').select('program_id').eq('id', reportId).single();
  if (rep0) await requireCompanyRole(rep0.program_id);
  // Money moves inside the DB function (membership + idempotency enforced there)
  const { data: awardId, error } = await supabase.rpc('award_bounty', { p_report: reportId, p_amount: amount });
  if (error || !awardId) throw moneyError(error);
  // Merit badges + stats refresh happen in-DB; re-check badge eligibility
  const { data: rep } = await supabase.from('reports').select('researcher_id').eq('id', reportId).single();
  if (rep) {
    const researcherId = (rep as unknown as { researcher_id: string }).researcher_id;
    await supabase.rpc('refresh_researcher_stats', { p_researcher: researcherId });
    await supabase.rpc('check_merit_badges', { p_researcher: researcherId });
    const { data: fresh } = await supabase
      .from('researcher_badges')
      .select('badge_id,awarded_at,badges!inner(code)')
      .eq('researcher_id', researcherId)
      .order('awarded_at', { ascending: false })
      .limit(1);
    const latest = (fresh ?? [])[0] as unknown as { badge_id: string; awarded_at: string; badges: { code: string } } | undefined;
    const justEarned = latest && Date.now() - new Date(latest.awarded_at).getTime() < 60_000;
    if (justEarned && latest) {
      const { data: rp } = await supabase.from('researcher_profiles').select('user_id').eq('id', researcherId).single();
      const uid = (rp as unknown as { user_id: string } | null)?.user_id;
      if (uid) {
        await notify(supabase, uid, {
          type: 'badge',
          title: `شارة جديدة: ${latest.badges.code}`,
          link: '/dashboard/badges',
        });
      }
    }
  }
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

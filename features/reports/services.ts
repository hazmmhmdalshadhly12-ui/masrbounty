'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { reportSchema } from '@/schemas/report';
import { enforceRate, limits } from '@/lib/rate-limit';
import { checkReportSubmissionLimit, recordAbuseAttempt } from '@/features/reports/limits';
import { logAudit } from '@/services/audit';
import { notify, reportParties } from '@/lib/notify';

async function researcherIdOrThrow() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Unauthorized');
  const { data: rp } = await supabase
    .from('researcher_profiles')
    .select('id')
    .eq('user_id', data.user.id)
    .single();
  if (!rp) throw new Error('Researcher profile not found');
  return { supabase, researcherId: rp.id as string };
}

export async function createReportAction(formData: FormData) {
  const raw = {
    program_id: formData.get('program_id'),
    title: formData.get('title'),
    summary: formData.get('summary'),
    vulnerability_type: formData.get('vulnerability_type'),
    severity: formData.get('severity'),
    affected_asset: formData.get('affected_asset'),
    description: formData.get('description'),
    impact: formData.get('impact'),
    reproduction_steps: formData.get('reproduction_steps'),
    remediation: formData.get('remediation') || undefined,
    cvss_score: formData.get('cvss_score') || undefined,
    cwe: formData.get('cwe') || undefined,
  };
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid report');
  const { supabase, researcherId } = await researcherIdOrThrow();
  enforceRate(`report:${researcherId}`, limits.reportCreate.max, limits.reportCreate.windowMs);
  // Private programs require an invitation — enforced server-side, not just hidden in UI
  const { data: program } = await supabase
    .from('programs')
    .select('id,visibility,status')
    .eq('id', parsed.data.program_id)
    .single();
  if (!program || program.status !== 'active') throw new Error('Program not available');
  if (program.visibility === 'private') {
    const { data: inv } = await supabase
      .from('program_researchers')
      .select('id')
      .eq('program_id', program.id)
      .eq('researcher_id', researcherId)
      .eq('status', 'accepted')
      .single();
    if (!inv) throw new Error('برنامج خاص — يلزم قبول الدعوة أولًا');
  }
  // generate report number server-side via DB function (MB-YYYY-000001).
  // No silent fallback: a missing RPC means the DB is not migrated and a
  // fake number would break the reference contract — fail loudly instead.
  const { data: num } = await supabase.rpc('generate_report_number');
  if (!num) throw new Error('تعذّر توليد الرقم المرجعي — تأكد من تنفيذ الترحيلات ثم أعد المحاولة');
  // Team scope: submitting "as a team" requires an active membership holding
  // researcher.submit_reports (verified here AND in the rep_insert RLS policy).
  // Personal reports stay untouched: team_id NULL = personal (legacy rows).
  const scope = String(formData.get('submission_scope') ?? 'personal');
  let teamId: string | null = null;
  if (scope === 'team') {
    teamId = String(formData.get('team_id') ?? '');
    if (!teamId) throw new Error('اختر الفريق المقدِّم للتقرير');
    const { data: me } = await supabase.auth.getUser();
    const uid = me.user?.id;
    if (!uid) throw new Error('Unauthorized');
    const { data: tm } = await supabase
      .from('team_members')
      .select('id,role,permissions')
      .eq('team_id', teamId)
      .eq('user_id', uid)
      .maybeSingle();
    const member = tm as { id: string; role: string; permissions: unknown } | null;
    const isOwner =
      !!member &&
      !!(await supabase.from('teams').select('owner_id').eq('id', teamId).eq('owner_id', uid).maybeSingle()).data;
    const { hasPermission, parseOverrides } = await import('@/lib/teams/permissions');
    if (
      !member ||
      !hasPermission(
        { role: isOwner ? 'owner' : member.role, isOwner, overrides: parseOverrides(member.permissions) },
        'researcher.submit_reports'
      )
    ) {
      throw new Error('لا تملك صلاحية إرسال التقارير باسم هذا الفريق');
    }
  }
  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      ...parsed.data,
      researcher_id: researcherId,
      report_number: num as string,
      status: 'draft',
      team_id: teamId,
      submission_scope: teamId ? 'team' : 'personal',
    })
    .select('id')
    .single();
  if (error || !report) throw new Error(error?.message ?? 'Create failed');
  await logAudit('create', 'reports', report.id, { program_id: parsed.data.program_id }, (await supabase.auth.getUser()).data.user?.id);
  revalidatePath('/dashboard/reports');
  redirect(`/dashboard/reports/${report.id}`);
}

export async function submitReportAction(reportId: string) {
  const { supabase, researcherId } = await researcherIdOrThrow();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Unauthorized');
  // Daily/anti-abuse limits apply to SUBMISSIONS only — drafts and edits are
  // never limited (features/reports/limits.ts).
  const limitRes = await checkReportSubmissionLimit(researcherId, uid);
  if (!limitRes.allowed) {
    await recordAbuseAttempt(uid, 'report_limit_exceeded', `submission blocked: ${limitRes.reason ?? ''}`);
    throw new Error(limitRes.reason ?? 'تم بلوغ حد الإرسال اليومي');
  }
  // Return the updated rows so we can tell "already submitted / not yours"
  // apart from a successful submit (the WHERE status='draft' guard makes
  // the lifecycle transition draft → submitted the only path in).
  const { data: updated, error } = await supabase
    .from('reports')
    .update({ status: 'submitted' })
    .eq('id', reportId)
    .eq('researcher_id', researcherId)
    .eq('status', 'draft')
    .select('id,report_number');
  if (error) throw new Error(error.message);
  const row = (updated ?? [])[0] as { id: string; report_number: string } | undefined;
  if (!row) throw new Error('التقرير غير موجود أو تم إرساله مسبقًا');

  // Success confirmation to the researcher (spec: "تم إرسال التقرير بنجاح")
  await notify(supabase, uid, {
    type: 'report',
    title: `تم إرسال التقرير بنجاح — ${row.report_number}`,
    body: 'وصل التقرير للشركة وستصلك تحديثات الحالة هنا',
    link: `/dashboard/reports/${reportId}`,
  });

  // New-report notification to every company member (was missing entirely).
  const parties = await reportParties(supabase, reportId);
  for (const memberId of parties.memberUserIds) {
    if (memberId && memberId !== uid) {
      await notify(supabase, memberId, {
        type: 'report',
        title: `تقرير جديد وارد — ${parties.reportNumber}`,
        body: 'تقرير ثغرة جديد بحاجة إلى مراجعة أولية',
        link: `/company/reports/${reportId}`,
      });
    }
  }
  revalidatePath('/dashboard/reports');
  revalidatePath('/company/reports');
  // Success banner on the detail page (?submitted=1)
  redirect(`/dashboard/reports/${reportId}?submitted=1`);
}

export async function addCommentAction(reportId: string, formData: FormData) {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) throw new Error('Empty comment');
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Unauthorized');
  enforceRate(`comment:${data.user.id}`, limits.comment.max, limits.comment.windowMs);
  // Must be able to SEE the report at all (blocks commenting on strangers' reports by ID guessing)
  const { data: access } = await supabase.from('reports').select('id').eq('id', reportId).single();
  if (!access) throw new Error('غير موجود أو غير مصرّح');
  // Internal notes: only company members/admins may mark internal; everyone else posts public
  let isInternal = formData.get('is_internal') === 'on';
  const { data: report } = await supabase.from('reports').select('program_id').eq('id', reportId).single();
  let isMember = false;
  if (report) {
    const { data: prog } = await supabase.from('programs').select('company_id').eq('id', report.program_id).single();
    if (prog) {
      const { data: m } = await supabase
        .from('company_members')
        .select('id')
        .eq('company_id', (prog as { company_id: string }).company_id)
        .eq('user_id', data.user.id)
        .single();
      isMember = !!m;
    }
  }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id);
  const isStaff = (roles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'moderator');
  if (isInternal && !isMember && !isStaff) isInternal = false;
  const { error } = await supabase
    .from('report_comments')
    .insert({ report_id: reportId, author_id: data.user.id, body, is_internal: isInternal });
  if (error) throw new Error(error.message);
  // Notify the other side (never notify yourself; never leak internal notes to reporter)
  const parties = await reportParties(supabase, reportId);
  if (!isInternal && parties.reporterUserId && parties.reporterUserId !== data.user.id) {
    await notify(supabase, parties.reporterUserId, {
      type: 'comment',
      title: `تعليق جديد على التقرير ${parties.reportNumber}`,
      link: `/dashboard/reports/${reportId}`,
    });
  }
  if (isMember || isStaff) {
    for (const uid of parties.memberUserIds) {
      if (uid !== data.user.id) {
        await notify(supabase, uid, {
          type: 'comment',
          title: `تعليق جديد على التقرير ${parties.reportNumber}`,
          link: `/company/reports/${reportId}`,
        });
      }
    }
  }
  revalidatePath(`/dashboard/reports/${reportId}`);
}

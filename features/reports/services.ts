'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { reportSchema } from '@/schemas/report';
import { enforceRate, limits } from '@/lib/rate-limit';
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
  };
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid report');
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
  // generate report number server-side via DB function
  const { data: num } = await supabase.rpc('generate_report_number');
  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      ...parsed.data,
      researcher_id: researcherId,
      report_number: (num as string) ?? `MB-${Date.now()}`,
      status: 'draft',
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
  const { error } = await supabase
    .from('reports')
    .update({ status: 'submitted' })
    .eq('id', reportId)
    .eq('researcher_id', researcherId)
    .eq('status', 'draft');
  if (error) throw new Error(error.message);
  await supabase.from('notifications').insert({
    user_id: (await supabase.auth.getUser()).data.user!.id,
    type: 'report',
    title: 'Report submitted',
    link: `/dashboard/reports/${reportId}`,
  });
  revalidatePath('/dashboard/reports');
}

export async function addCommentAction(reportId: string, formData: FormData) {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) throw new Error('Empty comment');
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Unauthorized');
  enforceRate(`comment:${data.user.id}`, limits.comment.max, limits.comment.windowMs);
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

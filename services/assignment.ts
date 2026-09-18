'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify, reportParties } from '@/lib/notify';

type CompanyRole = 'owner' | 'admin' | 'triager' | 'viewer';

const ALLOWED: CompanyRole[] = ['owner', 'admin', 'triager'];

async function requireTriager(programId: string) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: program } = await supabase.from('programs').select('company_id').eq('id', programId).single();
  if (!program) throw new Error('Program not found');
  const companyId = (program as { company_id: string }).company_id;

  // owner check
  const { data: company } = await supabase.from('company_profiles').select('owner_id').eq('id', companyId).maybeSingle();
  if (company && (company as { owner_id: string }).owner_id === user.user.id) {
    return { supabase, userId: user.user.id, companyId };
  }
  const { data: member } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.user.id)
    .maybeSingle();
  const role = (member as { role: string } | null)?.role as CompanyRole | undefined;
  if (!role || !ALLOWED.includes(role)) {
    throw new Error('ليس لديك صلاحية التكليف — يلزم دور triager على الأقل');
  }
  return { supabase, userId: user.user.id, companyId };
}

export async function assignReport(reportId: string, assigneeId: string): Promise<void> {
  if (!assigneeId) throw new Error('اختر عضوًا');
  const supabase0 = await createServerClient();
  const { data: report } = await supabase0.from('reports').select('program_id').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  const { supabase, userId, companyId } = await requireTriager((report as { program_id: string }).program_id);

  const { data: member } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('user_id', assigneeId)
    .maybeSingle();

  // also allow owner who may not be in company_members
  let isOwner = false;
  if (!member) {
    const { data: cp } = await supabase.from('company_profiles').select('owner_id').eq('id', companyId).maybeSingle();
    isOwner = !!(cp && (cp as { owner_id: string }).owner_id === assigneeId);
    if (!isOwner) throw new Error('العضو ليس ضمن فريق الشركة');
  }

  const { error } = await supabase.from('report_assignees').upsert(
    { report_id: reportId, user_id: assigneeId, assigned_by: userId },
    { onConflict: 'report_id,user_id' }
  );
  if (error) throw new Error(error.message);
  await logAudit('update', 'report_assignees', reportId, { assignee: assigneeId }, userId);
  // notify assignee
  await notify(supabase, assigneeId, {
    type: 'report',
    title: `تم تكليفك بتقرير`,
    link: `/company/reports/${reportId}`,
  });
  revalidatePath(`/company/reports/${reportId}`);
  revalidatePath('/company/reports');
}

export async function reassignReport(reportId: string, fromUserId: string, toUserId: string): Promise<void> {
  if (!toUserId) throw new Error('اختر عضوًا');
  if (fromUserId === toUserId) return;
  const supabase0 = await createServerClient();
  const { data: report } = await supabase0.from('reports').select('program_id').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  const { supabase, userId } = await requireTriager((report as { program_id: string }).program_id);
  // remove old
  if (fromUserId) {
    await supabase.from('report_assignees').delete().eq('report_id', reportId).eq('user_id', fromUserId);
  }
  await assignReport(reportId, toUserId);
  await logAudit('update', 'report_assignees', reportId, { reassign: `${fromUserId} -> ${toUserId}` }, userId);
}

export async function unassignReport(reportId: string, assigneeId: string): Promise<void> {
  const supabase0 = await createServerClient();
  const { data: report } = await supabase0.from('reports').select('program_id').eq('id', reportId).single();
  if (!report) throw new Error('Not found');
  const { supabase, userId } = await requireTriager((report as { program_id: string }).program_id);
  const { error } = await supabase.from('report_assignees').delete().eq('report_id', reportId).eq('user_id', assigneeId);
  if (error) throw new Error(error.message);
  await logAudit('update', 'report_assignees', reportId, { unassign: assigneeId }, userId);
  revalidatePath(`/company/reports/${reportId}`);
  revalidatePath('/company/reports');
}

// Form-action wrappers for use in <form action=...>
export async function assignReportAction(reportId: string, formData: FormData): Promise<void> {
  const assigneeId = String(formData.get('assignee_id') ?? '').trim();
  await assignReport(reportId, assigneeId);
}

export async function unassignReportAction(reportId: string, userId: string): Promise<void> {
  await unassignReport(reportId, userId);
}

export async function getReportAssignees(reportId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('report_assignees')
    .select('user_id, assigned_by, created_at, profiles!inner(username, avatar_url)')
    .eq('report_id', reportId);
  return (data ?? []) as unknown as { user_id: string; assigned_by: string | null; created_at: string; profiles: { username: string; avatar_url: string | null } }[];
}

export async function getCompanyMembersForReports(companyId: string) {
  const supabase = await createServerClient();
  const { data: members } = await supabase
    .from('company_members')
    .select('user_id, role, profiles!inner(username, avatar_url)')
    .eq('company_id', companyId);
  const { data: company } = await supabase.from('company_profiles').select('owner_id').eq('id', companyId).maybeSingle();
  const ownerId = (company as { owner_id: string } | null)?.owner_id ?? null;
  let ownerEntry: { user_id: string; role: string; profiles: { username: string; avatar_url: string | null } } | null = null;
  if (ownerId) {
    const { data: p } = await supabase.from('profiles').select('username, avatar_url').eq('id', ownerId).maybeSingle();
    if (p) ownerEntry = { user_id: ownerId, role: 'owner', profiles: p as { username: string; avatar_url: string | null } };
  }
  const list = ((members ?? []) as unknown as { user_id: string; role: string; profiles: { username: string; avatar_url: string | null } }[]);
  if (ownerEntry && !list.some((m) => m.user_id === ownerId)) list.unshift(ownerEntry);
  return list;
}

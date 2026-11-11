'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify } from '@/lib/notify';
import { enforceRate } from '@/lib/rate-limit';
import { requireCompanyPermission } from '@/lib/teams/guard';
import {
  canAssignCompanyRole,
  canEditMember,
  canGrantPermissions,
  COMPANY_PERMISSIONS,
  COMPANY_PERMISSION_LABELS,
  COMPANY_ROLE_LABELS_AR,
  parseOverrides,
  serializeOverrides,
  PROGRAM_MEMBER_ROLES,
} from '@/lib/teams/permissions';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const INVITABLE_ROLES = ['admin', 'analyst', 'triager', 'finance', 'viewer'] as const;

function safeBack(formData: FormData, fallback: string): string {
  const back = String(formData.get('back') ?? '');
  return back.startsWith('/') && !back.startsWith('//') ? back : fallback;
}

function fail(back: string, message: string): never {
  redirect(`${back}${back.includes('?') ? '&' : '?'}error=` + encodeURIComponent(message));
}

function done(back: string, message: string): never {
  redirect(`${back}${back.includes('?') ? '&' : '?'}ok=` + encodeURIComponent(message));
}

async function callerId(): Promise<string> {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect('/login');
  return user.user.id;
}

/** Resolve a platform account by email through the service-role client. */
async function findUserIdByEmail(email: string): Promise<string | null> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    type Lookup = { getUserByEmail?: (e: string) => Promise<{ data: { user: { id: string } | null } | null }> };
    const adminApi = admin.auth.admin as unknown as Lookup;
    if (typeof adminApi.getUserByEmail === 'function') {
      const { data } = await adminApi.getUserByEmail(email);
      return data?.user?.id ?? null;
    }
    for (let page = 1; page <= 5; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const users = (data?.users ?? []) as { id: string; email?: string }[];
      const hit = users.find((u) => (u.email ?? '').toLowerCase() === email);
      if (hit) return hit.id;
      if (users.length < 200) break;
    }
  } catch {
    /* invitations still work without a resolved user */
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Company member invitations
// ─────────────────────────────────────────────────────────────────────────────

export async function inviteCompanyMemberAction(formData: FormData) {
  const companyId = String(formData.get('company_id') ?? '');
  const back = safeBack(formData, '/company/team');
  const ctx = await requireCompanyPermission(companyId, 'company.manage_members');
  enforceRate(`company-invite:${ctx.userId}`, 30, 60_000);
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'viewer');
  const grant = formData.getAll('grant').map(String).filter((p) => COMPANY_PERMISSIONS.includes(p as never));
  const perms = serializeOverrides({ grant, revoke: [] });
  if (!EMAIL_RE.test(email)) fail(back, 'بريد إلكتروني غير صالح');
  if (!INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number])) fail(back, 'دور غير صالح');
  const grants = canGrantPermissions(ctx.subject, COMPANY_PERMISSIONS, perms.grant);
  if (!grants.ok) fail(back, `لا يمكنك منح صلاحيات لا تملكها: ${grants.missing.map((m) => COMPANY_PERMISSION_LABELS[m as keyof typeof COMPANY_PERMISSION_LABELS] ?? m).join('، ')}`);
  if (!canAssignCompanyRole(ctx.subject, role)) fail(back, 'لا يمكنك منح دور أعلى من دورك');
  const supabase = await createServerClient();
  const { data: rawToken, error } = await supabase.rpc('fn_create_company_invitation', {
    p_company: companyId,
    p_email: email,
    p_role: role,
    p_permissions: perms,
  });
  if (error) {
    const raw = error.message;
    if (/pending invitation/.test(raw)) fail(back, 'توجد دعوة معلّقة بالفعل لهذا البريد');
    if (/already a member/.test(raw)) fail(back, 'هذا المستخدم عضو بالفريق بالفعل');
    if (/forbidden/.test(raw)) fail(back, 'ليس لديك صلاحية دعوة أعضاء');
    fail(back, 'تعذر إنشاء الدعوة — تأكد من تطبيق ترحيلات قاعدة البيانات (29) ثم حاول مجددًا');
  }
  const invitedUserId = await findUserIdByEmail(email);
  if (invitedUserId) {
    await notify(supabase, invitedUserId, {
      type: 'team',
      title: `دعوة للانضمام إلى فريق شركة: ${ctx.companyName}`,
      body: `الدور المقترح: ${COMPANY_ROLE_LABELS_AR[role] ?? role}`,
      link: '/dashboard/invitations',
    });
  }
  await logAudit('create', 'company_invitations', companyId, { email, role, grant }, ctx.userId);
  revalidatePath('/company/team');
  revalidatePath('/dashboard/invitations');
  const origin = String(formData.get('origin') ?? '').startsWith('http') ? String(formData.get('origin')) : '';
  const link = origin
    ? `${origin}/company/team/accept?token=${encodeURIComponent(String(rawToken))}`
    : '/company/team/accept (الرابط يُولَّد من صفحة الفريق)';
  done(back, `تم إنشاء الدعوة — رابط القبول: ${link}`);
}

/** Accept/reject a company invitation from دعواتي (by id) or legacy email link (by token). */
export async function respondCompanyInvitationAction(formData: FormData) {
  const userId = await callerId();
  const supabase = await createServerClient();
  const token = String(formData.get('token') ?? '').trim();
  const invitationId = String(formData.get('invitation_id') ?? '').trim();
  const accept = formData.get('accept') === '1';
  const back = safeBack(formData, '/dashboard/invitations');
  if (!token && !invitationId) fail(back, 'مرجع الدعوة مفقود');
  const { data: companyId, error } = await supabase.rpc('fn_respond_company_invitation', {
    p_token: token || null,
    p_accept: accept,
    p_invitation_id: token ? null : invitationId,
  });
  if (error) {
    const raw = error.message;
    if (/expired/.test(raw)) fail(back, 'انتهت صلاحية الدعوة');
    if (/different email/.test(raw)) fail(back, 'الدعوة موجهة لبريد آخر — سجّل الدخول بنفس البريد');
    if (/invitation is/.test(raw)) fail(back, 'لا يمكن قبول هذه الدعوة (منتهية أو مستخدمة مسبقًا)');
    fail(back, 'تعذر تنفيذ القرار على الدعوة — حاول لاحقًا');
  }
  await logAudit('update', 'company_invitations', invitationId || 'token', { accepted: accept }, userId);
  revalidatePath('/dashboard/invitations');
  revalidatePath('/company/team');
  revalidatePath('/dashboard/member');
  if (accept && companyId) {
    done('/company', 'انضممت إلى فريق الشركة — أهلًا بك');
  }
  done(back, accept ? 'تم قبول الدعوة' : 'تم رفض الدعوة');
}

export async function revokeCompanyInvitationAction(formData: FormData) {
  const companyId = String(formData.get('company_id') ?? '');
  const back = safeBack(formData, '/company/team');
  const ctx = await requireCompanyPermission(companyId, 'company.manage_members');
  const invitationId = String(formData.get('invitation_id') ?? '');
  const supabase = await createServerClient();
  const { error } = await supabase.rpc('fn_revoke_company_invitation', { p_invitation_id: invitationId });
  if (error) fail(back, 'تعذر إلغاء الدعوة (قد تكون مستخدمة بالفعل)');
  await logAudit('update', 'company_invitations', invitationId, { revoked: true }, ctx.userId);
  revalidatePath('/company/team');
  done(back, 'تم إلغاء الدعوة');
}

export async function resendCompanyInvitationAction(formData: FormData) {
  const companyId = String(formData.get('company_id') ?? '');
  const back = safeBack(formData, '/company/team');
  const ctx = await requireCompanyPermission(companyId, 'company.manage_members');
  const invitationId = String(formData.get('invitation_id') ?? '');
  const supabase = await createServerClient();
  const { data: rawToken, error } = await supabase.rpc('fn_resend_company_invitation', { p_invitation_id: invitationId });
  if (error || !rawToken) fail(back, 'تعذر إعادة إرسال الدعوة');
  await logAudit('update', 'company_invitations', invitationId, { resent: true }, ctx.userId);
  const origin = String(formData.get('origin') ?? '').startsWith('http') ? String(formData.get('origin')) : '';
  const link = origin ? `${origin}/company/team/accept?token=${encodeURIComponent(String(rawToken))}` : '';
  revalidatePath('/company/team');
  done(back, link ? `أُعيدت الدعوة — الرابط الجديد: ${link}` : 'أُعيدت الدعوة — الرابط الجديد ظاهر في قائمة الدعوات');
}

// ─────────────────────────────────────────────────────────────────────────────
// Member roles + granular permissions
// ─────────────────────────────────────────────────────────────────────────────

export async function updateCompanyMemberAction(formData: FormData) {
  const companyId = String(formData.get('company_id') ?? '');
  const back = safeBack(formData, '/company/team');
  const memberId = String(formData.get('member_id') ?? '');
  const role = String(formData.get('role') ?? 'viewer');
  const grant = formData.getAll('grant').map(String).filter((p) => COMPANY_PERMISSIONS.includes(p as never));
  const revoke = formData.getAll('revoke').map(String).filter((p) => COMPANY_PERMISSIONS.includes(p as never));
  const perms = serializeOverrides({ grant, revoke });
  const ctx = await requireCompanyPermission(companyId, 'company.manage_members');
  const supabase = await createServerClient();
  const { data: target } = await supabase
    .from('company_members')
    .select('id,user_id,role,profiles!inner(username,full_name)')
    .eq('id', memberId)
    .eq('company_id', companyId)
    .maybeSingle();
  const t = target as { id: string; user_id: string; role: string; profiles: { username: string; full_name: string | null } } | null;
  if (!t) fail(back, 'العضو غير موجود');
  if (!INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number])) fail(back, 'دور غير صالح');
  const guard = canEditMember(ctx.subject, { role: t.role, self: t.user_id === ctx.userId }, true);
  if (!guard.ok) fail(back, guard.reason ?? 'غير مصرّح');
  if (!canAssignCompanyRole(ctx.subject, role)) fail(back, 'لا يمكنك منح دور أعلى من دورك');
  const grants = canGrantPermissions(ctx.subject, COMPANY_PERMISSIONS, perms.grant);
  if (!grants.ok) fail(back, `لا يمكنك منح صلاحيات لا تملكها: ${grants.missing.map((m) => COMPANY_PERMISSION_LABELS[m as keyof typeof COMPANY_PERMISSION_LABELS] ?? m).join('، ')}`);
  // admin role is owner-only (SQL trigger enforces the same rule)
  if (role === 'admin' && !ctx.isOwner) fail(back, 'منح دور المسؤول متاح لمالك الشركة فقط');
  const { error } = await supabase
    .from('company_members')
    .update({ role, permissions: perms })
    .eq('id', memberId);
  if (error) {
    if (/self-escalation/.test(error.message)) fail(back, 'لا يمكنك تعديل عضويتك بنفسك');
    if (/admin role/.test(error.message)) fail(back, 'منح دور المسؤول متاح لمالك الشركة فقط');
    fail(back, 'تعذر تحديث العضو: ' + error.message);
  }
  await notify(supabase, t.user_id, {
    type: 'team',
    title: `تحديث صلاحياتك في شركة ${ctx.companyName}`,
    body: `الدور: ${COMPANY_ROLE_LABELS_AR[role] ?? role}`,
    link: '/dashboard/member',
  });
  await logAudit('update', 'company_members', memberId, { role, ...perms }, ctx.userId);
  revalidatePath('/company/team');
  done(back, `تم تحديث عضوية ${t.profiles.full_name || t.profiles.username}`);
}

export async function removeCompanyMemberAction(formData: FormData) {
  const companyId = String(formData.get('company_id') ?? '');
  const back = safeBack(formData, '/company/team');
  const memberId = String(formData.get('member_id') ?? '');
  const confirmName = String(formData.get('confirm_name') ?? '').trim();
  const ctx = await requireCompanyPermission(companyId, 'company.manage_members');
  const supabase = await createServerClient();
  const { data: target } = await supabase
    .from('company_members')
    .select('id,user_id,role,profiles!inner(username,full_name)')
    .eq('id', memberId)
    .eq('company_id', companyId)
    .maybeSingle();
  const t = target as { id: string; user_id: string; role: string; profiles: { username: string; full_name: string | null } } | null;
  if (!t) fail(back, 'العضو غير موجود');
  if (t.role === 'admin' && !ctx.isOwner) fail(back, 'إزالة المسؤولين متاحة لمالك الشركة فقط');
  if (confirmName !== (t.profiles.full_name || t.profiles.username)) {
    fail(back, 'اكتب اسم العضو بدقة لتأكيد الإزالة');
  }
  const { error } = await supabase.from('company_members').delete().eq('id', memberId);
  if (error) fail(back, 'تعذر إزالة العضو: ' + error.message);
  await notify(supabase, t.user_id, {
    type: 'team',
    title: `تمت إزالتك من فريق شركة ${ctx.companyName}`,
    link: '/dashboard/member',
  });
  await logAudit('delete', 'company_members', memberId, { company: companyId }, ctx.userId);
  revalidatePath('/company/team');
  done(back, `تمت إزالة ${t.profiles.full_name || t.profiles.username} من الفريق`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Program assignments
// ─────────────────────────────────────────────────────────────────────────────

export async function assignProgramMemberAction(formData: FormData) {
  const programId = String(formData.get('program_id') ?? '');
  const back = safeBack(formData, `/company/programs/${programId}`);
  const targetUserId = String(formData.get('user_id') ?? '');
  const programRole = String(formData.get('program_role') ?? 'viewer');
  const supabase = await createServerClient();
  const { data: program } = await supabase.from('programs').select('id,company_id,name').eq('id', programId).maybeSingle();
  const p = program as { id: string; company_id: string; name: string } | null;
  if (!p) fail(back, 'البرنامج غير موجود');
  const ctx = await requireCompanyPermission(p.company_id, 'program.manage');
  if (!PROGRAM_MEMBER_ROLES.includes(programRole as (typeof PROGRAM_MEMBER_ROLES)[number])) fail(back, 'دور برنامج غير صالح');
  const { data: member } = await supabase
    .from('company_members')
    .select('id,profiles!inner(username,full_name)')
    .eq('company_id', p.company_id)
    .eq('user_id', targetUserId)
    .maybeSingle();
  const m = member as { id: string; profiles: { username: string; full_name: string | null } } | null;
  if (!m) fail(back, 'المستخدم ليس عضوًا في فريق الشركة');
  const { error } = await supabase.rpc('fn_assign_program_member', {
    p_program: programId,
    p_user: targetUserId,
    p_role: programRole,
  });
  if (error) fail(back, 'تعذر تعيين العضو للبرنامج: ' + error.message);
  await notify(supabase, targetUserId, {
    type: 'team',
    title: `تعيينك لبرنامج: ${p.name}`,
    body: 'افتح البرنامج لمراجعة نطاقك وصلاحياتك',
    link: `/programs/${p.id}`,
  });
  await logAudit('create', 'program_members', programId, { user: targetUserId, role: programRole }, ctx.userId);
  revalidatePath(`/company/programs/${programId}`);
  done(back, `تم تعيين ${m.profiles.full_name || m.profiles.username} على البرنامج`);
}

export async function unassignProgramMemberAction(formData: FormData) {
  const programId = String(formData.get('program_id') ?? '');
  const back = safeBack(formData, `/company/programs/${programId}`);
  const targetUserId = String(formData.get('user_id') ?? '');
  const supabase = await createServerClient();
  const { data: program } = await supabase.from('programs').select('id,company_id').eq('id', programId).maybeSingle();
  const p = program as { id: string; company_id: string } | null;
  if (!p) fail(back, 'البرنامج غير موجود');
  const ctx = await requireCompanyPermission(p.company_id, 'program.manage');
  const { error } = await supabase.rpc('fn_unassign_program_member', { p_program: programId, p_user: targetUserId });
  if (error) fail(back, 'تعذر إلغاء التعيين');
  await logAudit('delete', 'program_members', programId, { user: targetUserId }, ctx.userId);
  revalidatePath(`/company/programs/${programId}`);
  done(back, 'تم إلغاء تعيين العضو من البرنامج');
}

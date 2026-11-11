'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify } from '@/lib/notify';
import { enforceRate } from '@/lib/rate-limit';
import { getTeamContext, requireTeamPermission } from '@/lib/teams/guard';
import {
  canAssignTeamRole,
  canEditMember,
  canGrantPermissions,
  parseOverrides,
  RESEARCHER_TEAM_PERMISSIONS,
  serializeOverrides,
  TEAM_ROLE_LABELS,
  type TeamMemberRole,
} from '@/lib/teams/permissions';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Only same-site relative paths are accepted as redirect targets. */
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

/**
 * Resolve a platform account by email through the service-role client.
 * Uses getUserByEmail when the installed supabase-js exposes it, with a
 * paginated listUsers fallback — never throws to the caller.
 */
async function findUserIdByEmail(email: string): Promise<string | null> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    type Lookup = { getUserByEmail?: (e: string) => Promise<{ data: { user: { id: string } | null } | null }> };
    const adminApi = admin.auth.admin as unknown as Lookup;
    if (typeof adminApi.getUserByEmail === 'function') {
      const { data } = await adminApi.getUserByEmail(email);
      if (data?.user?.id) return data.user.id;
      return null;
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

function readPermissions(formData: FormData): { grant: string[]; revoke: string[] } {
  const grant = formData.getAll('grant').map(String).filter((p) => RESEARCHER_TEAM_PERMISSIONS.includes(p as never));
  const revoke = formData.getAll('revoke').map(String).filter((p) => RESEARCHER_TEAM_PERMISSIONS.includes(p as never));
  return serializeOverrides({ grant, revoke });
}

function inviteLink(origin: string, token: string): string {
  return `${origin}/dashboard/invitations?token=${encodeURIComponent(token)}`;
}

async function siteOrigin(): Promise<string> {
  const { headers } = await import('next/headers');
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'https';
    if (host) return `${proto}://${host}`;
  } catch {
    /* fall through */
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://masrbounty.online';
}

// ─────────────────────────────────────────────────────────────────────────────
// Team lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export async function createTeamAction(formData: FormData) {
  const userId = await callerId();
  const supabase = await createServerClient();
  enforceRate(`team-create:${userId}`, 5, 60 * 60_000);
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim().slice(0, 1000);
  const logoUrl = String(formData.get('logo_url') ?? '').trim();
  const allowJoin = formData.get('allow_join_requests') === 'on';
  const maxMembers = Number(formData.get('max_members') ?? 15);
  if (name.length < 2 || name.length > 80) fail('/dashboard/team', 'اسم الفريق يجب أن يكون بين 2 و 80 حرفًا');
  if (logoUrl && !/^https?:\/\//.test(logoUrl)) fail('/dashboard/team', 'رابط الشعار غير صالح');
  if (!Number.isFinite(maxMembers) || maxMembers < 1 || maxMembers > 50) fail('/dashboard/team', 'الحد الأقصى للأعضاء بين 1 و 50');
  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      name,
      description: description || null,
      logo_url: logoUrl || null,
      owner_id: userId,
      allow_join_requests: allowJoin,
      max_members: Math.round(maxMembers),
    })
    .select('id')
    .single();
  if (error || !team) fail('/dashboard/team', 'تعذر إنشاء الفريق — تأكد أن ترحيلات قاعدة البيانات مُطبّقة ثم حاول مجددًا');
  const teamId = (team as { id: string }).id;
  await logAudit('create', 'teams', teamId, { name }, userId);
  revalidatePath('/dashboard/team');
  revalidatePath('/dashboard');
  redirect(`/dashboard/teams/${teamId}`);
}

export async function updateTeamAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const back = safeBack(formData, `/dashboard/teams/${teamId}`);
  const ctx = await requireTeamPermission(teamId, 'team.manage_settings');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim().slice(0, 1000);
  const logoUrl = String(formData.get('logo_url') ?? '').trim();
  const allowJoin = formData.get('allow_join_requests') === 'on';
  const maxMembers = Number(formData.get('max_members') ?? ctx.team.max_members);
  if (name.length < 2 || name.length > 80) fail(back, 'اسم الفريق يجب أن يكون بين 2 و 80 حرفًا');
  if (logoUrl && !/^https?:\/\//.test(logoUrl)) fail(back, 'رابط الشعار غير صالح');
  if (!Number.isFinite(maxMembers) || maxMembers < 1 || maxMembers > 50) fail(back, 'الحد الأقصى للأعضاء بين 1 و 50');
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('teams')
    .update({
      name,
      description: description || null,
      logo_url: logoUrl || null,
      allow_join_requests: allowJoin,
      max_members: Math.round(maxMembers),
    })
    .eq('id', teamId);
  if (error) fail(back, 'تعذر حفظ الإعدادات: ' + error.message);
  await supabase.rpc('fn_log_team_event', { p_team: teamId, p_action: 'team.updated', p_meta: { by: ctx.userId } });
  await logAudit('update', 'teams', teamId, { name }, ctx.userId);
  revalidatePath(`/dashboard/teams/${teamId}`);
  done(back, 'تم حفظ إعدادات الفريق');
}

export async function deleteTeamAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const ctx = await requireTeamPermission(teamId, 'team.manage_settings');
  if (!ctx.isOwner) fail(`/dashboard/teams/${teamId}`, 'حذف الفريق متاح لقائد الفريق فقط');
  const supabase = await createServerClient();
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) fail(`/dashboard/teams/${teamId}`, 'تعذر حذف الفريق: ' + error.message);
  await logAudit('delete', 'teams', teamId, {}, ctx.userId);
  revalidatePath('/dashboard/team');
  redirect('/dashboard/team?ok=' + encodeURIComponent('تم حذف الفريق وجميع عضوياته'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Invitations
// ─────────────────────────────────────────────────────────────────────────────

export async function inviteTeamMemberAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const back = safeBack(formData, `/dashboard/teams/${teamId}`);
  const ctx = await requireTeamPermission(teamId, 'team.invite_members');
  enforceRate(`team-invite:${ctx.userId}`, 30, 60_000);
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'member');
  const message = String(formData.get('message') ?? '').trim().slice(0, 300);
  const perms = readPermissions(formData);
  if (!EMAIL_RE.test(email)) fail(back, 'بريد إلكتروني غير صالح');
  if (role !== 'lead' && role !== 'member') fail(back, 'دور غير صالح');
  const grants = canGrantPermissions(
    { role: ctx.member?.role ?? 'owner', isOwner: ctx.isOwner, overrides: parseOverrides(ctx.member?.permissions) },
    RESEARCHER_TEAM_PERMISSIONS,
    perms.grant
  );
  if (!grants.ok) fail(back, `لا يمكنك منح صلاحيات لا تملكها: ${grants.missing.join('، ')}`);
  const supabase = await createServerClient();
  const invitedUserId = await findUserIdByEmail(email);
  const { data: rawToken, error } = await supabase.rpc('fn_create_team_invitation', {
    p_team: teamId,
    p_email: email,
    p_role: role,
    p_permissions: perms,
    p_message: message || null,
  });
  if (error) {
    const raw = error.message;
    if (/pending invitation/.test(raw)) fail(back, 'توجد دعوة معلّقة بالفعل لهذا البريد');
    if (/team is full/.test(raw)) fail(back, 'الفريق ممتلئ — لا يمكن دعوة أعضاء إضافيين');
    if (/already a member/.test(raw)) fail(back, 'هذا المستخدم عضو بالفريق بالفعل');
    if (/forbidden/.test(raw)) fail(back, 'ليس لديك صلاحية دعوة أعضاء');
    fail(back, 'تعذر إنشاء الدعوة — تأكد من تطبيق ترحيلات قاعدة البيانات (28) ثم حاول مجددًا');
  }
  // in-app notification to the invitee when the account exists
  if (invitedUserId) {
    await notify(supabase, invitedUserId, {
      type: 'team',
      title: `دعوة للانضمام إلى فريق: ${ctx.team.name}`,
      body: `الدور المقترح: ${TEAM_ROLE_LABELS[role as TeamMemberRole] ?? role}`,
      link: '/dashboard/invitations',
    });
  }
  await logAudit('create', 'team_invitations', teamId, { email, role }, ctx.userId);
  const origin = await siteOrigin();
  revalidatePath(`/dashboard/teams/${teamId}`);
  done(back, `تم إنشاء الدعوة — رابط القبول: ${inviteLink(origin, String(rawToken))}`);
}

/** Accept (or reject) from the دعواتي page or an email link (?token=). */
export async function respondTeamInvitationAction(formData: FormData) {
  const userId = await callerId();
  const supabase = await createServerClient();
  const token = String(formData.get('token') ?? '').trim();
  const invitationId = String(formData.get('invitation_id') ?? '').trim();
  const accept = formData.get('accept') === '1';
  const back = safeBack(formData, '/dashboard/invitations');
  if (!invitationId) fail(back, 'مرجع الدعوة مفقود — افتح صفحة دعواتي وأعد المحاولة');
  const { data: inv } = await supabase
    .from('team_invitations')
    .select('id,team_id,role,invited_by,teams!inner(name)')
    .eq('id', invitationId)
    .maybeSingle();
  const invRow = inv as { id: string; team_id: string; role: string; invited_by: string | null; teams: { name: string } } | null;
  if (!invRow) fail(back, 'الدعوة غير موجودة');
  if (accept) {
    const { data: teamId, error } = await supabase.rpc('fn_accept_team_invitation', {
      p_token: token || null,
      p_invitation_id: token ? null : invitationId,
    });
    if (error) {
      const raw = error.message;
      if (/expired/.test(raw)) fail(back, 'انتهت صلاحية الدعوة');
      if (/different email/.test(raw)) fail(back, 'الدعوة موجهة لبريد آخر — سجّل الدخول بنفس البريد');
      if (/invitation is/.test(raw)) fail(back, 'لا يمكن قبول هذه الدعوة (منتهية أو مستخدمة مسبقًا)');
      fail(back, 'تعذر قبول الدعوة — حاول لاحقًا');
    }
    if (invRow.invited_by) {
      await notify(supabase, invRow.invited_by, {
        type: 'team',
        title: `قبل أحد الدعوة للانضمام إلى: ${invRow.teams.name}`,
        body: `الدور: ${TEAM_ROLE_LABELS[invRow.role as TeamMemberRole] ?? invRow.role}`,
        link: `/dashboard/teams/${invRow.team_id}`,
      });
    }
    await logAudit('update', 'team_invitations', invitationId, { accepted: true }, userId);
    revalidatePath('/dashboard/invitations');
    revalidatePath('/dashboard/member');
    done(`/dashboard/teams/${String(teamId)}`, `انضممت إلى فريق ${invRow.teams.name} — أهلًا بك`);
  }
  const { error: rejErr } = await supabase.rpc('fn_reject_team_invitation', { p_invitation_id: invitationId });
  if (rejErr) fail(back, 'تعذر رفض الدعوة — حاول لاحقًا');
  if (invRow.invited_by) {
    await notify(supabase, invRow.invited_by, {
      type: 'team',
      title: `رفض أحد الدعوة للانضمام إلى: ${invRow.teams.name}`,
      link: `/dashboard/teams/${invRow.team_id}`,
    });
  }
  await logAudit('update', 'team_invitations', invitationId, { accepted: false }, userId);
  revalidatePath('/dashboard/invitations');
  done(back, 'تم رفض الدعوة');
}

export async function revokeTeamInvitationAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const back = safeBack(formData, `/dashboard/teams/${teamId}`);
  const ctx = await requireTeamPermission(teamId, 'team.invite_members');
  const invitationId = String(formData.get('invitation_id') ?? '');
  const supabase = await createServerClient();
  const { error } = await supabase.rpc('fn_revoke_team_invitation', { p_invitation_id: invitationId });
  if (error) fail(back, 'تعذر إلغاء الدعوة (قد تكون مستخدمة بالفعل)');
  const { data: inv } = await supabase
    .from('team_invitations')
    .select('invited_user_id')
    .eq('id', invitationId)
    .maybeSingle();
  const invited = (inv as { invited_user_id: string | null } | null)?.invited_user_id;
  if (invited) {
    await notify(supabase, invited, {
      type: 'team',
      title: `تم إلغاء دعوتك إلى فريق: ${ctx.team.name}`,
      link: '/dashboard/invitations',
    });
  }
  await logAudit('update', 'team_invitations', invitationId, { revoked: true }, ctx.userId);
  revalidatePath(`/dashboard/teams/${teamId}`);
  done(back, 'تم إلغاء الدعوة');
}

export async function resendTeamInvitationAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const back = safeBack(formData, `/dashboard/teams/${teamId}`);
  await requireTeamPermission(teamId, 'team.invite_members');
  const invitationId = String(formData.get('invitation_id') ?? '');
  const supabase = await createServerClient();
  const { data: rawToken, error } = await supabase.rpc('fn_resend_team_invitation', { p_invitation_id: invitationId });
  if (error || !rawToken) fail(back, 'تعذر إعادة إرسال الدعوة');
  await logAudit('update', 'team_invitations', invitationId, { resent: true });
  const origin = await siteOrigin();
  revalidatePath(`/dashboard/teams/${teamId}`);
  done(back, `أُعيدت الدعوة — الرابط الجديد: ${inviteLink(origin, String(rawToken))}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Members
// ─────────────────────────────────────────────────────────────────────────────

export async function changeTeamMemberAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const back = safeBack(formData, `/dashboard/teams/${teamId}`);
  const memberId = String(formData.get('member_id') ?? '');
  const role = String(formData.get('role') ?? 'member');
  const ctx = await requireTeamPermission(teamId, 'team.manage_members');
  const perms = readPermissions(formData);
  const supabase = await createServerClient();
  const { data: target } = await supabase
    .from('team_members')
    .select('id,user_id,role,profiles!inner(username,full_name)')
    .eq('id', memberId)
    .eq('team_id', teamId)
    .maybeSingle();
  const t = target as
    | { id: string; user_id: string; role: string; profiles: { username: string; full_name: string | null } }
    | null;
  if (!t) fail(back, 'العضو غير موجود');
  const actor: { role: string; isOwner: boolean; overrides: ReturnType<typeof parseOverrides> } = {
    role: ctx.member?.role ?? 'owner',
    isOwner: ctx.isOwner,
    overrides: parseOverrides(ctx.member?.permissions),
  };
  const guard = canEditMember(actor, { role: t.role, self: t.user_id === ctx.userId }, false);
  if (!guard.ok) fail(back, guard.reason ?? 'غير مصرّح');
  if (role !== 'lead' && role !== 'member') fail(back, 'دور غير صالح');
  if (!ctx.isOwner && role === 'lead') fail(back, 'ترقية عضو إلى نائب القائد متاحة لقائد الفريق فقط');
  const grants = canGrantPermissions(actor, RESEARCHER_TEAM_PERMISSIONS, perms.grant);
  if (!grants.ok) fail(back, `لا يمكنك منح صلاحيات لا تملكها: ${grants.missing.join('، ')}`);
  const { error } = await supabase.rpc('fn_change_team_member', {
    p_member_id: memberId,
    p_role: role,
    p_grant: perms.grant,
    p_revoke: perms.revoke,
  });
  if (error) {
    if (/self-escalation/.test(error.message)) fail(back, 'لا يمكنك تعديل عضويتك بنفسك');
    if (/owner membership/.test(error.message)) fail(back, 'عضوية قائد الفريق غير قابلة للتعديل');
    fail(back, 'تعذر تحديث العضو: ' + error.message);
  }
  await notify(supabase, t.user_id, {
    type: 'team',
    title: `تغيّر دورك في فريق ${ctx.team.name}`,
    body: `الدور الجديد: ${TEAM_ROLE_LABELS[role as TeamMemberRole] ?? role}`,
    link: `/dashboard/teams/${teamId}`,
  });
  await logAudit('update', 'team_members', memberId, { role, ...perms }, ctx.userId);
  revalidatePath(`/dashboard/teams/${teamId}`);
  done(back, `تم تحديث عضوية ${t.profiles.full_name || t.profiles.username}`);
}

export async function removeTeamMemberAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const back = safeBack(formData, `/dashboard/teams/${teamId}`);
  const memberId = String(formData.get('member_id') ?? '');
  const confirmName = String(formData.get('confirm_name') ?? '').trim();
  const ctx = await requireTeamPermission(teamId, 'team.manage_members');
  const supabase = await createServerClient();
  const { data: target } = await supabase
    .from('team_members')
    .select('id,user_id,role,profiles!inner(username,full_name)')
    .eq('id', memberId)
    .eq('team_id', teamId)
    .maybeSingle();
  const t = target as { id: string; user_id: string; role: string; profiles: { username: string; full_name: string | null } } | null;
  if (!t) fail(back, 'العضو غير موجود');
  if (t.user_id === ctx.userId) fail(back, 'لإخلاء العضوية استخدم زر مغادرة الفريق');
  if (t.role === 'owner') fail(back, 'قائد الفريق غير قابل للإزالة — انقل الملكية أولًا');
  if (confirmName !== (t.profiles.full_name || t.profiles.username)) {
    fail(back, 'اكتب اسم العضو بدقة لتأكيد الإزالة');
  }
  const { error } = await supabase.rpc('fn_remove_team_member', { p_member_id: memberId });
  if (error) fail(back, 'تعذر إزالة العضو: ' + error.message);
  await notify(supabase, t.user_id, {
    type: 'team',
    title: `تمت إزالتك من فريق ${ctx.team.name}`,
    link: '/dashboard/member',
  });
  await logAudit('delete', 'team_members', memberId, { team: teamId }, ctx.userId);
  revalidatePath(`/dashboard/teams/${teamId}`);
  done(back, `تمت إزالة ${t.profiles.full_name || t.profiles.username} من الفريق`);
}

export async function leaveTeamAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const userId = await callerId();
  const supabase = await createServerClient();
  const { error } = await supabase.rpc('fn_leave_team', { p_team: teamId });
  if (error) {
    if (/owner cannot leave/.test(error.message)) {
      fail('/dashboard/teams/' + teamId, 'قائد الفريق لا يستطيع المغادرة — انقل الملكية أولًا');
    }
    fail('/dashboard/team', 'تعذر مغادرة الفريق');
  }
  await logAudit('delete', 'team_members', teamId, { left: true }, userId);
  revalidatePath('/dashboard/team');
  revalidatePath('/dashboard/member');
  done('/dashboard/team', 'تمت مغادرة الفريق');
}

export async function transferOwnershipAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const newOwnerUserId = String(formData.get('new_owner') ?? '');
  const back = `/dashboard/teams/${teamId}`;
  const ctx = await requireTeamPermission(teamId, 'team.manage_settings');
  if (!ctx.isOwner) fail(back, 'نقل الملكية متاح لقائد الفريق فقط');
  if (!newOwnerUserId || newOwnerUserId === ctx.userId) fail(back, 'اختر عضوًا آخر لنقل الملكية إليه');
  const supabase = await createServerClient();
  const { error } = await supabase.rpc('fn_transfer_team_ownership', { p_team: teamId, p_new_owner: newOwnerUserId });
  if (error) fail(back, 'تعذر نقل الملكية — تأكد أن العضو الجديد عضو نشط في الفريق');
  await notify(supabase, newOwnerUserId, {
    type: 'team',
    title: `أصبحت قائد فريق: ${ctx.team.name}`,
    body: 'نُقلت إليك ملكية الفريق مع كامل الصلاحيات',
    link: `/dashboard/teams/${teamId}`,
  });
  await logAudit('update', 'teams', teamId, { owner_transferred_to: newOwnerUserId }, ctx.userId);
  revalidatePath(`/dashboard/teams/${teamId}`);
  revalidatePath('/dashboard/team');
  done(back, 'تم نقل ملكية الفريق');
}

// ─────────────────────────────────────────────────────────────────────────────
// Join requests
// ─────────────────────────────────────────────────────────────────────────────

export async function requestTeamJoinAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const userId = await callerId();
  const message = String(formData.get('message') ?? '').trim().slice(0, 300);
  const supabase = await createServerClient();
  const { data: team } = await supabase
    .from('teams')
    .select('id,name,owner_id')
    .eq('id', teamId)
    .maybeSingle();
  const t = team as { id: string; name: string; owner_id: string } | null;
  if (!t) fail('/dashboard/team', 'الفريق غير موجود');
  enforceRate(`team-join:${userId}`, 10, 60_000);
  const { error } = await supabase.rpc('fn_request_team_join', { p_team: teamId, p_message: message || null });
  if (error) {
    if (/disabled/.test(error.message)) fail(`/dashboard/teams/${teamId}`, 'هذا الفريق لا يقبل طلبات الانضمام');
    if (/already pending/.test(error.message)) fail(`/dashboard/teams/${teamId}`, 'لديك طلب انضمام معلّق بالفعل');
    if (/already a member/.test(error.message)) fail(`/dashboard/teams/${teamId}`, 'أنت عضو في هذا الفريق بالفعل');
    fail(`/dashboard/teams/${teamId}`, 'تعذر إرسال طلب الانضمام');
  }
  await notify(supabase, t.owner_id, {
    type: 'team',
    title: 'طلب انضمام جديد إلى فريقك',
    body: `${t.name}${message ? ` — «${message}»` : ''}`,
    link: `/dashboard/teams/${teamId}`,
  });
  await logAudit('create', 'team_join_requests', teamId, {}, userId);
  revalidatePath(`/dashboard/teams/${teamId}`);
  done(`/dashboard/teams/${teamId}`, 'أُرسل طلب الانضمام — سيُخطرك النظام عند القرار');
}

export async function decideTeamJoinAction(formData: FormData) {
  const teamId = String(formData.get('team_id') ?? '');
  const requestId = String(formData.get('request_id') ?? '');
  const approve = formData.get('approve') === '1';
  const back = `/dashboard/teams/${teamId}`;
  const ctx = await requireTeamPermission(teamId, 'team.manage_members');
  const supabase = await createServerClient();
  const { data: req } = await supabase
    .from('team_join_requests')
    .select('id,user_id,profiles!inner(username,full_name)')
    .eq('id', requestId)
    .eq('team_id', teamId)
    .maybeSingle();
  const r = req as { id: string; user_id: string; profiles: { username: string; full_name: string | null } } | null;
  if (!r) fail(back, 'الطلب غير موجود');
  const { error } = await supabase.rpc('fn_decide_team_join', { p_request: requestId, p_approve: approve });
  if (error) {
    if (/team is full/.test(error.message)) fail(back, 'الفريق ممتلئ — لا يمكن قبول الطلب');
    fail(back, 'تعذر تنفيذ القرار');
  }
  await notify(supabase, r.user_id, {
    type: 'team',
    title: approve ? `تم قبول انضمامك إلى فريق ${ctx.team.name}` : `تم رفض طلب انضمامك إلى ${ctx.team.name}`,
    link: approve ? `/dashboard/teams/${teamId}` : '/dashboard/team',
  });
  await logAudit('update', 'team_join_requests', requestId, { approved: approve }, ctx.userId);
  revalidatePath(back);
  done(back, approve ? `انضم ${r.profiles.full_name || r.profiles.username} إلى الفريق` : 'تم رفض الطلب');
}

// ─────────────────────────────────────────────────────────────────────────────
// Member experience
// ─────────────────────────────────────────────────────────────────────────────

/** member-only accounts may become researchers later without losing memberships */
export async function promoteToResearcherAction(formData: FormData) {
  const userId = await callerId();
  const supabase = await createServerClient();
  const back = safeBack(formData, '/dashboard/member');
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  const mine = new Set((roles ?? []).map((r: { role: string }) => r.role));
  if (!mine.has('member')) fail(back, 'هذه الميزة متاحة لحسابات العضو');
  const { data: existing } = await supabase
    .from('researcher_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) fail(back, 'حسابك باحث بالفعل');
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', userId).single();
  const username = (profile as { username: string } | null)?.username ?? 'member';
  const { data: rp, error: rpErr } = await supabase
    .from('researcher_profiles')
    .insert({ user_id: userId, display_name: username })
    .select('id')
    .single();
  if (rpErr || !rp) fail(back, 'تعذر إنشاء الملف البحثي — اسم المستخدم قد يكون مستخدمًا');
  await supabase.from('wallets').insert({ researcher_id: (rp as { id: string }).id });
  await supabase.from('researcher_reputation').insert({ researcher_id: (rp as { id: string }).id, score: 0 });
  await supabase.from('researcher_stats').insert({ researcher_id: (rp as { id: string }).id });
  const { error: roleErr } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'researcher' }, { onConflict: 'user_id,role' });
  if (roleErr) fail(back, 'تعذر منح دور الباحث');
  await logAudit('create', 'researcher_profiles', (rp as { id: string }).id, { via: 'member_upgrade' }, userId);
  revalidatePath('/dashboard');
  redirect('/dashboard?ok=' + encodeURIComponent('أصبحت باحثًا — يمكنك الآن إرسال التقارير'));
}

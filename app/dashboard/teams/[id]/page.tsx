import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth/guard';
import { getTeamContext } from '@/lib/teams/guard';
import { getMyTeams } from '@/lib/teams/queries';
import {
  changeTeamMemberAction,
  decideTeamJoinAction,
  inviteTeamMemberAction,
  leaveTeamAction,
  removeTeamMemberAction,
  resendTeamInvitationAction,
  revokeTeamInvitationAction,
  transferOwnershipAction,
  updateTeamAction,
  deleteTeamAction,
} from '@/features/teams/actions';
import { MemberActionsDialog } from '@/components/teams/member-actions';
import { PermissionPicker, PermissionChips, type PermissionOption } from '@/components/teams/permission-picker';
import { WorkspaceSwitcher, type WorkspaceOption } from '@/components/teams/workspace-switcher';
import { hasPermission, parseOverrides, TEAM_PERMISSION_LABELS, TEAM_ROLE_LABELS, RESEARCHER_TEAM_PERMISSIONS, invitationStatusLabel, type TeamMemberRole } from '@/lib/teams/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Avatar } from '@/components/shared/avatar';
import {
  AlertTriangle,
  ArrowRightLeft,
  Inbox,
  LogOut,
  ScrollText,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const ACTIVITY_LABELS: Record<string, string> = {
  'team.created': 'إنشاء الفريق',
  'team.updated': 'تحديث إعدادات الفريق',
  'team.owner_transferred': 'نقل ملكية الفريق',
  'member.invited': 'دعوة عضو',
  'member.joined': 'انضمام عضو',
  'member.updated': 'تغيير دور/صلاحيات عضو',
  'member.removed': 'إزالة عضو',
  'member.left': 'مغادرة عضو',
  'invitation.rejected': 'رفض دعوة',
  'invitation.revoked': 'إلغاء دعوة',
  'invitation.resent': 'إعادة إرسال دعوة',
  'join_request.rejected': 'رفض طلب انضمام',
};

export default async function TeamWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await requireSession({ next: `/dashboard/teams/${id}` });
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user!.id;
  const ctx = await getTeamContext(id, uid);
  if (!ctx) redirect('/dashboard/team?error=' + encodeURIComponent('الفريق غير موجود'));
  const { team, member } = ctx;
  const isOwner = ctx.isOwner;
  const subject = {
    role: member?.role ?? 'owner',
    isOwner,
    overrides: parseOverrides(member?.permissions),
  };
  const myPerms = RESEARCHER_TEAM_PERMISSIONS.filter((p) => hasPermission(subject, p));
  const canManageMembers = myPerms.includes('team.manage_members');
  const canInvite = myPerms.includes('team.invite_members');
  const canManageSettings = myPerms.includes('team.manage_settings');
  const back = `/dashboard/teams/${id}`;
  const permissionOptions: PermissionOption[] = RESEARCHER_TEAM_PERMISSIONS.map((p) => ({
    key: p,
    label: TEAM_PERMISSION_LABELS[p],
  }));

  // data
  const [{ data: membersRaw }, { data: invitesRaw }, { data: requestsRaw }, { data: activityRaw }, { data: reportsRaw }] =
    await Promise.all([
      supabase
        .from('team_members')
        .select('id,user_id,role,permissions,joined_at,profiles!team_members_user_id_fkey(username,full_name,avatar_url)')
        .eq('team_id', id)
        .order('joined_at', { ascending: true }),
      supabase
        .from('team_invitations')
        .select('id,email,role,permissions,status,expires_at,created_at')
        .eq('team_id', id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('team_join_requests')
        .select('id,user_id,message,status,created_at,profiles!team_join_requests_user_id_fkey(username,full_name,avatar_url)')
        .eq('team_id', id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('team_activity_logs')
        .select('id,action,created_at,actor_id,target_user_id,metadata,profiles!team_activity_logs_actor_id_fkey(username)')
        .eq('team_id', id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('reports')
        .select('id,report_number,title,status,created_at,researcher_id,researcher_profiles!reports_researcher_id_fkey(display_name)')
        .eq('team_id', id)
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

  type MemberRaw = {
    id: string;
    user_id: string;
    role: string;
    permissions: unknown;
    joined_at: string;
    profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
  };
  const members = (membersRaw ?? []) as unknown as MemberRaw[];
  const invites = (invitesRaw ?? []) as unknown as {
    id: string;
    email: string;
    role: string;
    permissions: unknown;
    status: string;
    expires_at: string;
    created_at: string;
  }[];
  const joinRequests = (requestsRaw ?? []) as unknown as {
    id: string;
    user_id: string;
    message: string | null;
    status: string;
    created_at: string;
    profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
  }[];
  const activity = (activityRaw ?? []) as unknown as {
    id: string;
    action: string;
    created_at: string;
    actor_id: string | null;
    target_user_id: string | null;
    profiles: { username: string } | null;
  }[];
  const reports = (reportsRaw ?? []) as unknown as {
    id: string;
    report_number: string;
    title: string;
    status: string;
    created_at: string;
    researcher_profiles: { display_name: string } | null;
  }[];

  const myTeams = await getMyTeams(uid);
  const workspaces: WorkspaceOption[] = [
    { kind: 'personal', label: 'حسابي الشخصي', href: '/dashboard' },
    ...myTeams.map<WorkspaceOption>((t) => ({
      kind: 'researcher_team',
      label: t.name,
      sublabel: TEAM_ROLE_LABELS[t.role as TeamMemberRole] ?? String(t.role),
      href: `/dashboard/teams/${t.id}`,
      active: t.id === id,
    })),
    { kind: 'member', label: 'لوحة العضويات والدعوات', href: '/dashboard/member' },
  ];

  const ownerRow = members.find((m) => m.role === 'owner');

  return (
    <div className="container max-w-3xl space-y-6 py-8" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader icon={Users} title={team.name} desc={team.description ?? 'مساحة عمل الفريق البحثي'} />
        <WorkspaceSwitcher workspaces={workspaces} />
      </div>

      {sp.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
          <CardContent className="p-3 text-sm text-red-700 dark:text-red-300">{sp.error}</CardContent>
        </Card>
      )}
      {sp.ok && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CardContent className="p-3 text-sm text-emerald-700 dark:text-emerald-300">{sp.ok}</CardContent>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">الأعضاء ({members.length}/{team.max_members})</CardTitle>
          <CardDescription>الأدوار والصلاحيات الفعّالة لكل عضو — التعديل يمرّ بفحص الصلاحيات على الخادم.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => {
            const mSubject = {
              role: m.role === 'owner' ? 'owner' : m.role,
              isOwner: m.role === 'owner',
              overrides: parseOverrides(m.permissions),
            };
            const eff = RESEARCHER_TEAM_PERMISSIONS.filter((p) => hasPermission(mSubject, p));
            const fullName = m.profiles?.full_name || m.profiles?.username || 'مستخدم';
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={m.profiles?.username ?? '؟'} src={m.profiles?.avatar_url} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{m.profiles?.username ?? '—'} · انضم {new Date(m.joined_at).toLocaleDateString('ar-EG')}
                    </p>
                    <div className="mt-1">
                      <PermissionChips labels={eff.map((p) => TEAM_PERMISSION_LABELS[p])} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${m.role === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-muted'}`}>
                    {TEAM_ROLE_LABELS[m.role as TeamMemberRole] ?? m.role}
                  </span>
                  <MemberActionsDialog
                    member={{
                      id: m.id,
                      user_id: m.user_id,
                      role: m.role,
                      username: m.profiles?.username ?? '',
                      fullName,
                      granted: parseOverrides(m.permissions).grant,
                      revoked: parseOverrides(m.permissions).revoke,
                      self: m.user_id === uid,
                      isOwnerRow: m.role === 'owner',
                    }}
                    mode="team"
                    roleOptions={[
                      { value: 'member', label: TEAM_ROLE_LABELS.member },
                      ...(isOwner ? [{ value: 'lead', label: TEAM_ROLE_LABELS.lead }] : []),
                    ]}
                    permissionOptions={permissionOptions}
                    canManage={canManageMembers}
                    formAction={changeTeamMemberAction}
                    removeAction={removeTeamMemberAction}
                    back={back}
                    extraFields={{ team_id: id }}
                  />
                </div>
              </div>
            );
          })}
          {members.length === 1 && (
            <p className="text-sm text-muted-foreground">الفريق يضمك أنت فقط — ابدأ بدعوة زملائك من النموذج أدناه.</p>
          )}
          {!isOwner && (
            <form action={leaveTeamAction} className="pt-1">
              <input type="hidden" name="team_id" value={id} />
              <Button type="submit" variant="outline" size="sm" className="gap-1 text-xs text-red-600 dark:text-red-400">
                <LogOut className="h-3.5 w-3.5" /> مغادرة الفريق
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserPlus className="h-4 w-4" /> الدعوات
          </CardTitle>
          <CardDescription>
            الدعوة تصل للبريد المسجّل فقط — تُقبل من صفحة «دعواتي» أو رابط القبول، وتنتهي تلقائيًا بعد 7 أيام.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canInvite && (
            <form action={inviteTeamMemberAction} className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
              <input type="hidden" name="team_id" value={id} />
              <input type="hidden" name="back" value={back} />
              <div className="space-y-1.5">
                <label htmlFor="inv-email" className="text-xs font-medium">البريد الإلكتروني المسجّل *</label>
                <input id="inv-email" name="email" type="email" required dir="ltr" placeholder="researcher@example.com"
                  className="h-9 w-full rounded-md border bg-card px-2 text-sm dark:border-slate-700" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="inv-role" className="text-xs font-medium">الدور المقترح</label>
                <select id="inv-role" name="role" className="h-9 w-full rounded-md border bg-card px-2 text-sm dark:border-slate-700">
                  <option value="member">{TEAM_ROLE_LABELS.member}</option>
                  {isOwner && <option value="lead">{TEAM_ROLE_LABELS.lead}</option>}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <p className="text-xs font-medium">صلاحيات إضافية للعضو</p>
                <PermissionPicker options={permissionOptions} name="grant" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="inv-msg" className="text-xs font-medium">رسالة اختيارية</label>
                <input id="inv-msg" name="message" maxLength={300} placeholder="نرحّب بك في الفريق…"
                  className="h-9 w-full rounded-md border bg-card px-2 text-sm dark:border-slate-700" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm">إرسال الدعوة</Button>
              </div>
            </form>
          )}
          {!canInvite && (
            <p className="text-sm text-muted-foreground">دعوة الأعضاء متاحة لمن يملك صلاحية «دعوة أعضاء» أو «إدارة الأعضاء».</p>
          )}
          {canManageMembers && invites.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold">سجل الدعوات ({invites.length})</p>
              {invites.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" dir="ltr">{i.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {TEAM_ROLE_LABELS[i.role as TeamMemberRole] ?? i.role} · تنتهي {new Date(i.expires_at).toLocaleDateString('ar-EG')} ·{' '}
                      {invitationStatusLabel(i.status)}
                    </p>
                  </div>
                  {i.status === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <form action={resendTeamInvitationAction}>
                        <input type="hidden" name="team_id" value={id} />
                        <input type="hidden" name="invitation_id" value={i.id} />
                        <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">إعادة إرسال</Button>
                      </form>
                      <form action={revokeTeamInvitationAction}>
                        <input type="hidden" name="team_id" value={id} />
                        <input type="hidden" name="invitation_id" value={i.id} />
                        <Button type="submit" variant="outline" size="sm" className="h-7 border-red-200 text-xs text-red-600 dark:border-red-900 dark:text-red-400">
                          إلغاء
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Join requests */}
      {team.allow_join_requests && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Inbox className="h-4 w-4" /> طلبات الانضمام
            </CardTitle>
            <CardDescription>الطلبات المعلّقة من الباحثين الذين وجدوا فريقك.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {joinRequests.filter((r) => r.status === 'pending').map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.profiles?.username ?? '؟'} src={r.profiles?.avatar_url} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.profiles?.full_name || r.profiles?.username}</p>
                    {r.message && <p className="truncate text-xs text-muted-foreground">«{r.message}»</p>}
                  </div>
                </div>
                {canManageMembers && (
                  <div className="flex items-center gap-1.5">
                    <form action={decideTeamJoinAction}>
                      <input type="hidden" name="team_id" value={id} />
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="approve" value="1" />
                      <Button type="submit" size="sm" className="h-7 text-xs">قبول</Button>
                    </form>
                    <form action={decideTeamJoinAction}>
                      <input type="hidden" name="team_id" value={id} />
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="approve" value="0" />
                      <Button type="submit" variant="outline" size="sm" className="h-7 border-red-200 text-xs text-red-600 dark:border-red-900 dark:text-red-400">
                        رفض
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            ))}
            {!joinRequests.filter((r) => r.status === 'pending').length && (
              <p className="text-sm text-muted-foreground">لا توجد طلبات معلّقة.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">تقارير الفريق ({reports.length})</CardTitle>
          <CardDescription>
            التقارير المرسلة باسم الفريق — مقدم التقرير الفعلي مسجّل على كل تقرير، والشركة المستلمة تراها وفق سياسات البرنامج.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports.map((r) => (
            <Link key={r.id} href={`/dashboard/reports/${r.id}`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground" dir="ltr">
                  {r.report_number} · أرسله {r.researcher_profiles?.display_name ?? '—'}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs">{r.status}</span>
            </Link>
          ))}
          {!reports.length && (
            <p className="text-sm text-muted-foreground">
              لا توجد تقارير باسم الفريق بعد — عند إرسال تقرير جديد اختر «إرسال باسم الفريق» في نموذج التقارير.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Activity log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ScrollText className="h-4 w-4" /> سجل نشاط الفريق
          </CardTitle>
          <CardDescription>قراءة فقط — لا يمكن لأحد تعديل السجل أو حذفه.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {activity.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs">
              <span>
                <b>{ACTIVITY_LABELS[a.action] ?? a.action}</b>
                {a.profiles?.username ? ` — بواسطة @${a.profiles.username}` : ''}
              </span>
              <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString('ar-EG')}</span>
            </div>
          ))}
          {!activity.length && <p className="text-sm text-muted-foreground">لا يوجد نشاط بعد.</p>}
        </CardContent>
      </Card>

      {/* Settings */}
      {canManageSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings className="h-4 w-4" /> إعدادات الفريق
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={updateTeamAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="team_id" value={id} />
              <input type="hidden" name="back" value={back} />
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="st-name" className="text-sm font-medium">اسم الفريق</label>
                <input id="st-name" name="name" defaultValue={team.name} required minLength={2} maxLength={80}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm dark:border-slate-700" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="st-desc" className="text-sm font-medium">الوصف</label>
                <textarea id="st-desc" name="description" rows={3} maxLength={1000} defaultValue={team.description ?? ''}
                  className="w-full rounded-md border bg-card px-3 py-2 text-sm dark:border-slate-700" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="st-logo" className="text-sm font-medium">رابط الشعار</label>
                <input id="st-logo" name="logo_url" type="url" defaultValue={team.logo_url ?? ''} dir="ltr"
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm dark:border-slate-700" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="st-max" className="text-sm font-medium">الحد الأقصى للأعضاء</label>
                <input id="st-max" name="max_members" type="number" min={1} max={50} defaultValue={team.max_members}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm dark:border-slate-700" />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="allow_join_requests" defaultChecked={team.allow_join_requests} className="h-4 w-4" />
                السماح بطلبات الانضمام
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm">حفظ الإعدادات</Button>
              </div>
            </form>

            {isOwner && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-300">
                  <ArrowRightLeft className="h-4 w-4" /> نقل ملكية الفريق
                </p>
                <form action={transferOwnershipAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="team_id" value={id} />
                  <select name="new_owner" required className="h-9 rounded-md border bg-card px-2 text-sm dark:border-slate-700">
                    <option value="">اختر عضوًا…</option>
                    {members.filter((m) => m.role !== 'owner').map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.profiles?.full_name || m.profiles?.username}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline" size="sm">نقل الملكية</Button>
                </form>
              </div>
            )}

            {isOwner && (
              <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/30">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" /> منطقة الخطر — حذف الفريق نهائيًا
                </p>
                <form action={deleteTeamAction}>
                  <input type="hidden" name="team_id" value={id} />
                  <Button type="submit" variant="outline" size="sm" className="border-red-300 text-red-600 dark:border-red-800 dark:text-red-400">
                    حذف الفريق وكل عضوياته
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!myPerms.length && (
        <EmptyState title="لا تملك صلاحيات على هذا الفريق" hint="راجع قائد الفريق لمنحك الصلاحيات المناسبة." />
      )}

      <div className="flex justify-start">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/team">← كل الفرق</Link>
        </Button>
      </div>
    </div>
  );
}

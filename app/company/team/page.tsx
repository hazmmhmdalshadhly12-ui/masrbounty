import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Users, UserPlus, Building2, Inbox } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site-url';
import {
  inviteCompanyMemberAction,
  removeCompanyMemberAction,
  resendCompanyInvitationAction,
  revokeCompanyInvitationAction,
  updateCompanyMemberAction,
} from '@/features/teams/company-actions';
import { getMyCompanyMemberships } from '@/lib/teams/queries';
import { MemberActionsDialog } from '@/components/teams/member-actions';
import { PermissionPicker, PermissionChips, type PermissionOption } from '@/components/teams/permission-picker';
import { CopyButton } from '@/components/shared/copy-button';
import { StatusPill } from '@/components/shared/status-pill';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Avatar } from '@/components/shared/avatar';
import { hasPermission, parseOverrides, COMPANY_PERMISSION_LABELS, COMPANY_PERMISSIONS, COMPANY_ROLE_LABELS_AR, invitationStatusLabel, isInvitationAcceptable } from '@/lib/teams/permissions';

export const dynamic = 'force-dynamic';

type MemberRow = {
  id: string;
  role: string;
  permissions: unknown;
  joined_at: string;
  user_id: string;
  profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  token: string;
  permissions: unknown;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

const INVITABLE_ROLES = ['viewer', 'triager', 'analyst', 'finance', 'admin'] as const;
const ROLE_AR = COMPANY_ROLE_LABELS_AR;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect('/login?next=%2Fcompany%2Fteam');
  const uid = user.user.id;

  // Viewable companies = owned + membership (company admins can manage their team too)
  const memberships = await getMyCompanyMemberships(uid);
  if (!memberships.length) {
    return (
      <div className="container py-8" dir="rtl">
        <PageHeader icon={Users} title="فريق الشركة" desc="أعضاء فريقك وصلاحياتهم ودعواتهم المعلقة." />
        <EmptyState
          title="لا توجد شركة مرتبطة بحسابك"
          hint="أنشئ ملف شركتك أولًا ثم ابدأ بدعوة أعضاء الفريق للتعاون على برامجك."
          action={
            <Button asChild>
              <Link href="/company/onboarding">إنشاء شركة</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const company = memberships[0];
  const companyId = company.companyId;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  const origin = host ? `${proto}://${host}` : SITE_URL;

  const [{ data: membersRaw }, { data: invitesRaw }, { data: companyRow }] = await Promise.all([
    supabase
      .from('company_members')
      .select('id,role,permissions,joined_at,user_id,profiles!company_members_user_id_fkey(username,full_name,avatar_url)')
      .eq('company_id', companyId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('company_invitations')
      .select('id,email,role,token,permissions,status,expires_at,accepted_at,created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('company_profiles')
      .select('owner_id, profiles!company_profiles_owner_id_fkey(username,full_name,avatar_url)')
      .eq('id', companyId)
      .single(),
  ]);

  const members = ((membersRaw ?? []) as unknown) as MemberRow[];
  const invites = ((invitesRaw ?? []) as unknown) as InviteRow[];
  const owner = (companyRow as unknown as {
    owner_id: string;
    profiles: { username: string; full_name: string | null; avatar_url: string | null } | null;
  } | null) ?? null;

  const canManage = hasPermission(company.subject, 'company.manage_members');
  const canInvitePeople = canManage;
  const assignableRoles = INVITABLE_ROLES.filter((r) =>
    company.isOwner || hasPermission(company.subject, 'company.manage_members')
      ? company.isOwner || r !== 'admin'
      : false
  );
  const permissionOptions: PermissionOption[] = COMPANY_PERMISSIONS.map((p) => ({
    key: p,
    label: COMPANY_PERMISSION_LABELS[p],
  }));
  const nowIso = new Date().toISOString();

  return (
    <div className="container max-w-3xl py-8 space-y-6" dir="rtl">
      <PageHeader icon={Users} title="فريق الشركة" desc="أعضاء فريقك وصلاحياتهم التفصيلية ودعواتهم المعلقة." />

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4" /> {company.companyName} — الأعضاء ({members.length + 1})
          </CardTitle>
          <CardDescription>المؤسس وأعضاء الفريق — الدور + الصلاحيات الممنوحة يدويًا لكل عضو.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {owner && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={owner.profiles?.username ?? '؟'}
                  src={owner.profiles?.avatar_url}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{owner.profiles?.full_name || owner.profiles?.username}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    @{owner.profiles?.username}
                  </p>
                </div>
              </div>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {ROLE_AR.owner}
              </span>
            </div>
          )}
          {members.map((m) => {
            const mSubject = { role: m.role, isOwner: false, overrides: parseOverrides(m.permissions) };
            const eff = COMPANY_PERMISSIONS.filter((p) => hasPermission(mSubject, p));
            const fullName = m.profiles?.full_name || m.profiles?.username || 'مستخدم محذوف';
            return (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={m.profiles?.username ?? '؟'}
                    src={m.profiles?.avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{fullName}</p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">
                      {m.profiles ? `@${m.profiles.username}` : '—'} · انضم {new Date(m.joined_at).toLocaleDateString('ar-EG')}
                    </p>
                    <div className="mt-1">
                      <PermissionChips labels={eff.map((p) => COMPANY_PERMISSION_LABELS[p])} />
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    {ROLE_AR[m.role] ?? m.role}
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
                      isOwnerRow: false,
                    }}
                    mode="company"
                    roleOptions={assignableRoles.map((r) => ({ value: r, label: ROLE_AR[r] ?? r }))}
                    permissionOptions={permissionOptions}
                    canManage={canManage}
                    formAction={updateCompanyMemberAction}
                    removeAction={removeCompanyMemberAction}
                    back="/company/team"
                    extraFields={{ company_id: companyId }}
                  />
                </div>
              </div>
            );
          })}
          {!members.length && <p className="py-2 text-sm text-muted-foreground">لا يوجد أعضاء بعد — ابدأ بدعوة فريقك.</p>}
        </CardContent>
      </Card>

      {canInvitePeople ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4" /> دعوة عضو جديد
            </CardTitle>
            <CardDescription>
              اختر الدور والصلاحيات بدقة — تصل الدعوة إلى صاحب البريد فقط، وتنتهي بعد 7 أيام.
              العضو يستطيع قبولها من صفحة «دعواتي» أو من رابط القبول.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={inviteCompanyMemberAction} className="space-y-3">
              <input type="hidden" name="company_id" value={companyId} />
              <input type="hidden" name="back" value="/company/team" />
              <div className="flex flex-wrap items-center gap-2">
                <Input name="email" type="email" required placeholder="colleague@company.com" dir="ltr" className="max-w-xs" />
                <select name="role" className="h-10 rounded-md border bg-card px-2 text-sm dark:border-slate-700">
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_AR[r] ?? r}
                    </option>
                  ))}
                </select>
                <Button type="submit">إنشاء الدعوة</Button>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  صلاحيات إضافية تُمنح للعضو فوق صلاحيات دوره (اختياري):
                </p>
                <PermissionPicker options={permissionOptions} name="grant" />
              </div>
            </form>

            {invites.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold">الدعوات ({invites.length})</p>
                {invites.map((i) => {
                  const legacyPending = !i.status && !i.accepted_at && i.expires_at >= nowIso;
                  const status = i.status ?? (legacyPending ? 'pending' : i.accepted_at ? 'accepted' : i.expires_at < nowIso ? 'expired' : 'pending');
                  const acceptable = isInvitationAcceptable({ status, expires_at: i.expires_at });
                  return (
                    <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" dir="ltr">
                          {i.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          الدور: {ROLE_AR[i.role] ?? i.role} · {invitationStatusLabel(status)} · تنتهي{' '}
                          {new Date(i.expires_at).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {status === 'accepted' ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            مقبولة ✓
                          </span>
                        ) : status === 'expired' ? (
                          <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                            منتهية
                          </span>
                        ) : status === 'revoked' ? (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">ملغاة</span>
                        ) : status === 'rejected' ? (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">مرفوضة</span>
                        ) : (
                          <>
                            <CopyButton text={`${origin}/company/team/accept?token=${encodeURIComponent(i.token)}`} label="نسخ رابط القبول" />
                            {acceptable && (
                              <>
                                <form action={resendCompanyInvitationAction}>
                                  <input type="hidden" name="company_id" value={companyId} />
                                  <input type="hidden" name="invitation_id" value={i.id} />
                                  <input type="hidden" name="origin" value={origin} />
                                  <input type="hidden" name="back" value="/company/team" />
                                  <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">إعادة إرسال</Button>
                                </form>
                                <form action={revokeCompanyInvitationAction}>
                                  <input type="hidden" name="company_id" value={companyId} />
                                  <input type="hidden" name="invitation_id" value={i.id} />
                                  <input type="hidden" name="back" value="/company/team" />
                                  <Button type="submit" variant="outline" size="sm" className="h-7 border-red-200 text-xs text-red-600 dark:border-red-900 dark:text-red-400">
                                    إلغاء
                                  </Button>
                                </form>
                              </>
                            )}
                            <StatusPill value="pending" />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link href="/dashboard/invitations">
                  <Inbox className="h-4 w-4" /> دعواتي الموحّدة
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            يمكنك عرض الفريق فقط — إدارة الأعضاء والدعوات تتطلب صلاحية «إدارة الأعضاء».
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Input(props: React.ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={`h-10 rounded-md border bg-card px-3 text-sm dark:border-slate-700 ${props.className ?? ''}`}
    />
  );
}

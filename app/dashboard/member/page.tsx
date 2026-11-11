import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth/guard';
import { getMyPendingInvitations, getMyTeams, getMyCompanyMemberships } from '@/lib/teams/queries';
import { promoteToResearcherAction } from '@/features/teams/actions';
import { WorkspaceSwitcher, type WorkspaceOption } from '@/components/teams/workspace-switcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import {
  COMPANY_ROLE_LABELS_AR,
  COMPANY_PERMISSION_LABELS,
  TEAM_ROLE_LABELS,
  TEAM_PERMISSION_LABELS,
  parseOverrides,
  hasPermission,
  RESEARCHER_TEAM_PERMISSIONS,
  isInvitationAcceptable,
  type TeamMemberRole,
} from '@/lib/teams/permissions';
import { Inbox, LayoutDashboard, Sparkles, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MemberDashboardPage() {
  await requireSession({ next: '/dashboard/member' });
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user!.id;
  const email = (user.user?.email ?? '').toLowerCase();
  const [teams, companies, invitations] = await Promise.all([
    getMyTeams(uid),
    getMyCompanyMemberships(uid),
    getMyPendingInvitations(email, uid),
  ]);
  const pending = invitations.filter((i) => isInvitationAcceptable({ status: i.status, expires_at: i.expiresAt }));

  const workspaces: WorkspaceOption[] = [
    { kind: 'personal', label: 'حسابي الشخصي', href: '/dashboard' },
    ...teams.map<WorkspaceOption>((t) => ({
      kind: 'researcher_team',
      label: t.name,
      sublabel: TEAM_ROLE_LABELS[t.role as TeamMemberRole] ?? String(t.role),
      href: `/dashboard/teams/${t.id}`,
    })),
    ...companies.map<WorkspaceOption>((c) => ({
      kind: 'company',
      label: c.companyName,
      sublabel: COMPANY_ROLE_LABELS_AR[c.role] ?? c.role,
      href: '/company',
    })),
  ];

  // member-only accounts (no researcher profile) can upgrade later
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', uid).maybeSingle();
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', uid);
  const mine = new Set((roles ?? []).map((r: { role: string }) => r.role));
  const canUpgrade = !rp && mine.has('member');

  return (
    <div className="container max-w-3xl space-y-6 py-8" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader icon={LayoutDashboard} title="لوحة العضويات" desc="كل الفرق التي تنتمي إليها، أدوارك وصلاحياتك، ودعواتك المعلّقة." />
        <WorkspaceSwitcher workspaces={workspaces} />
      </div>

      {/* Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Inbox className="h-4 w-4" /> الدعوات الجديدة ({pending.length})
          </CardTitle>
          <CardDescription>قبل أو ارفض كل دعوة — تظهر عضويتك فورًا بعد القبول.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{i.targetName}</p>
                <p className="text-xs text-muted-foreground">
                  {i.kind === 'company' ? 'فريق شركة' : 'فريق باحثين'} · الدور:{' '}
                  {i.kind === 'company'
                    ? (COMPANY_ROLE_LABELS_AR[i.role] ?? i.role)
                    : (TEAM_ROLE_LABELS[i.role as TeamMemberRole] ?? i.role)}
                  {i.invitedByName ? ` · دعاك ${i.invitedByName}` : ''}
                  {' · '}تنتهي {new Date(i.expiresAt).toLocaleDateString('ar-EG')}
                </p>
                {Array.isArray((i.permissions as { grant?: string[] })?.grant) &&
                (i.permissions as { grant: string[] }).grant.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    صلاحيات إضافية:{' '}
                    {(i.permissions as { grant: string[] })
                      .grant.map((p) => (i.kind === 'company' ? COMPANY_PERMISSION_LABELS[p as keyof typeof COMPANY_PERMISSION_LABELS] : TEAM_PERMISSION_LABELS[p as keyof typeof TEAM_PERMISSION_LABELS]) ?? p)
                      .join('، ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {i.kind === 'company' ? (
                  <Link href="/dashboard/invitations" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                    مراجعة الدعوة
                  </Link>
                ) : (
                  <Link href="/dashboard/invitations" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                    مراجعة الدعوة
                  </Link>
                )}
              </div>
            </div>
          ))}
          {!pending.length && <p className="text-sm text-muted-foreground">لا توجد دعوات معلّقة — الدعوات الجديدة ستبلغك عبر الإشعارات أيضًا.</p>}
          <div className="pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/invitations">كل الدعوات</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Memberships */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" /> عضوياتك ({teams.length + companies.length})
          </CardTitle>
          <CardDescription>نوع كل فريق ودورك والصلاحيات المتاحة لك داخله.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {teams.map((t) => {
            const eff = [...t.permissions].filter((p) => (TEAM_PERMISSION_LABELS as Record<string, string>)[p]);
            return (
              <Link key={t.id} href={`/dashboard/teams/${t.id}`} className="block rounded-lg border px-3 py-2.5 hover:bg-muted/50">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold">{t.name}</p>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs">فريق باحثين</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  دورك: {TEAM_ROLE_LABELS[t.role as TeamMemberRole] ?? String(t.role)} · {t.memberCount} عضو
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  الصلاحيات: {eff.map((p) => TEAM_PERMISSION_LABELS[p as keyof typeof TEAM_PERMISSION_LABELS] ?? p).join('، ') || '—'}
                </p>
              </Link>
            );
          })}
          {companies.map((c) => (
            <Link key={c.companyId} href="/company" className="block rounded-lg border px-3 py-2.5 hover:bg-muted/50">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold">{c.companyName}</p>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs">فريق شركة</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">دورك: {COMPANY_ROLE_LABELS_AR[c.role] ?? c.role}</p>
            </Link>
          ))}
          {!teams.length && !companies.length && (
            <EmptyState
              title="لست عضوًا في أي فريق بعد"
              hint="اقبل دعوة من صفحة دعواتي، أو أنشئ فريق باحثين خاصًا بك من قسم «فريقي»."
            />
          )}
        </CardContent>
      </Card>

      {canUpgrade && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4" /> ترقية الحساب إلى باحث
            </CardTitle>
            <CardDescription>
              حساب العضو لا يمنعك من أي شيء: يمكنك البقاء عضوًا في كل فرقك **وأيضًا** إرسال تقارير شخصية بعد الترقية — بدون إنشاء حساب جديد.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={promoteToResearcherAction}>
              <Button type="submit" size="sm" className="gap-1">
                <Sparkles className="h-4 w-4" /> ترقية إلى باحث أمني
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/team">فريقي — إدارة فرق الباحثين</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">← لوحة الباحث</Link>
        </Button>
      </div>
    </div>
  );
}

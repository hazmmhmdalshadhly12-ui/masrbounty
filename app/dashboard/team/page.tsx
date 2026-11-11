import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth/guard';
import { getMyTeams } from '@/lib/teams/queries';
import { createTeamAction } from '@/features/teams/actions';
import { WorkspaceSwitcher, type WorkspaceOption } from '@/components/teams/workspace-switcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { TEAM_ROLE_LABELS, type TeamMemberRole } from '@/lib/teams/permissions';
import { Plus, Users, Inbox } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MyTeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  await requireSession({ next: '/dashboard/team' });
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user!.id;
  const teams = await getMyTeams(uid);
  const back = '/dashboard/team';

  const workspaces: WorkspaceOption[] = [
    { kind: 'personal', label: 'حسابي الشخصي', href: '/dashboard', active: false },
    ...teams.map<WorkspaceOption>((t) => ({
      kind: 'researcher_team',
      label: t.name,
      sublabel: TEAM_ROLE_LABELS[t.role as TeamMemberRole] ?? String(t.role),
      href: `/dashboard/teams/${t.id}`,
      active: false,
    })),
  ];

  return (
    <div className="container max-w-3xl space-y-6 py-8" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader icon={Users} title="فريقي" desc="أنشئ فريق باحثين، ادعُ زملاءك بالبريد المسجّل، وأدر الصلاحيات والطلبات." />
        <WorkspaceSwitcher workspaces={[...workspaces, { kind: 'member', label: 'لوحة العضويات والدعوات', href: '/dashboard/member', sublabel: 'كل فرقك ودعواتك' }]} />
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

      {teams.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">فرقك ({teams.length})</CardTitle>
            <CardDescription>افتح أي فريق لإدارة الأعضاء والدعوات والتقارير.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/teams/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{t.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.memberCount} عضو · {TEAM_ROLE_LABELS[t.role as TeamMemberRole] ?? String(t.role)}
                    </span>
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">إدارة الفريق ←</span>
              </Link>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link href="/dashboard/invitations">
                  <Inbox className="h-4 w-4" /> دعواتي
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="لا تضمك أي فريق بحثي بعد"
          hint="أنشئ فريقك الخاص لتبدأ دعوة الباحثين، أو انتظر دعوة من زميل — ستظهر في صفحة دعواتي."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> إنشاء فريق باحثين جديد
          </CardTitle>
          <CardDescription>
            الفريق يستقبل التقارير باسمه ويسجّل مَن أرسل كل تقرير فعليًا — حقوقك الشخصية محفوظة دائمًا.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTeamAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="team-name" className="text-sm font-medium">اسم الفريق *</label>
              <input
                id="team-name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="مثال: فريق Zero Day العربي"
                className="h-10 w-full rounded-md border bg-card px-3 text-sm dark:border-slate-700"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="team-desc" className="text-sm font-medium">الوصف</label>
              <textarea
                id="team-desc"
                name="description"
                rows={3}
                maxLength={1000}
                placeholder="تخصص الفريق وأهدافه وسياسة العمل المشترك…"
                className="w-full rounded-md border bg-card px-3 py-2 text-sm dark:border-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="team-logo" className="text-sm font-medium">رابط الشعار</label>
              <input
                id="team-logo"
                name="logo_url"
                type="url"
                placeholder="https://…"
                dir="ltr"
                className="h-10 w-full rounded-md border bg-card px-3 text-sm dark:border-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="team-max" className="text-sm font-medium">الحد الأقصى للأعضاء (1–50)</label>
              <input
                id="team-max"
                name="max_members"
                type="number"
                min={1}
                max={50}
                defaultValue={15}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm dark:border-slate-700"
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="allow_join_requests" className="h-4 w-4" />
              السماح للباحثين بإرسال طلبات انضمام إلى الفريق
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" className="gap-1">
                <Plus className="h-4 w-4" /> إنشاء الفريق
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

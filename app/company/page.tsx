import Link from 'next/link';
import { Building2, AppWindow, FileText, AlertTriangle, Wallet, Activity, Clock3 } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusPill } from '@/components/shared/status-pill';
import { EmptyState } from '@/components/shared/empty-state';
import { getSLAStatus } from '@/lib/sla';
import { ReportsByStatusChart, CompanySeverityChart } from '@/components/company/company-dashboard-charts';

export const dynamic = 'force-dynamic';

type CompanyRow = { id: string; name: string; slug: string };

export default async function CompanyHome() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="py-6 text-sm" dir="rtl">سجّل الدخول أولًا.</div>;

  const [{ data: memberships }, { data: owned }] = await Promise.all([
    supabase.from('company_members').select('company_id,role,company_profiles(id,name,slug)').eq('user_id', user.user.id),
    supabase.from('company_profiles').select('id,name,slug').eq('owner_id', user.user.id),
  ]);

  if (!memberships?.length && !owned?.length) {
    return (
      <div className="py-2" dir="rtl">
        <PageHeader icon={Building2} title="لوحة الشركة" desc="أنشئ ملف شركتك لبدء استقبال التقارير" />
        <EmptyState
          title="لا توجد شركة بعد"
          hint="أنشئ ملف الشركة من الإعدادات، أو اطلب من المالك دعوتك للفريق."
          action={<Link href="/company/settings" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-900">إعدادات الشركة</Link>}
        />
      </div>
    );
  }

  const memberCompanies = ((memberships ?? []) as unknown as { company_profiles: CompanyRow | null }[])
    .map((m) => m.company_profiles)
    .filter((v): v is CompanyRow => Boolean(v));
  const companies: CompanyRow[] = [...((owned ?? []) as CompanyRow[]), ...memberCompanies];
  // de-duplicate
  const uniqCompanies = [...new Map(companies.map((c) => [c.id, c] as const)).values()];
  const companyIds = uniqCompanies.map((c) => c.id);

  // Programs for my companies
  const { data: programs } = await supabase
    .from('programs')
    .select('id, name, status, company_id, created_at')
    .in('company_id', companyIds.length ? companyIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })
    .limit(100);

  const progList = (programs ?? []) as { id: string; name: string; status: string; company_id: string }[];
  const programIds = progList.map((p) => p.id);
  const activePrograms = progList.filter((p) => p.status === 'active').length;

  // Reports for my programs
  const { data: rawReports } = await supabase
    .from('reports')
    .select('id, report_number, title, status, severity, created_at, submitted_at, resolved_at, bounty_amount, program_id, researcher_id')
    .in('program_id', programIds.length ? programIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })
    .limit(300);

  type RRow = {
    id: string;
    report_number: string;
    title: string;
    status: string;
    severity: string;
    created_at: string;
    submitted_at: string | null;
    resolved_at: string | null;
    bounty_amount: number | string | null;
    program_id: string;
    researcher_id: string;
  };
  const reports = (rawReports ?? []) as RRow[];

  // pending reports: submitted + triaged
  const pendingReports = reports.filter((r) => r.status === 'submitted' || r.status === 'triaged').length;

  // SLA at-risk + overdue
  const slaAtRisk = reports.filter((r) => {
    const s = getSLAStatus({ status: r.status, created_at: r.created_at, submitted_at: r.submitted_at } as never);
    return s === 'at_risk' || s === 'overdue';
  }).length;

  // total bounty paid (from bounty_awards where status paid and report in my reports)
  let totalBountyPaid = 0;
  if (reports.length) {
    const reportIds = reports.map((r) => r.id);
    const { data: awards } = await supabase
      .from('bounty_awards')
      .select('amount,status,report_id')
      .in('report_id', reportIds)
      .limit(1000);
    const paid = (awards ?? []) as { amount: number | string; status: string }[];
    totalBountyPaid = paid.filter((a) => a.status === 'paid').reduce((sum, a) => sum + Number(a.amount ?? 0), 0);
    // fallback: if no bounty_awards paid, sum bounty_amount on resolved
    if (totalBountyPaid === 0) {
      totalBountyPaid = reports.filter((r) => r.status === 'resolved').reduce((s, r) => s + Number(r.bounty_amount ?? 0), 0);
    }
  }

  // reports by status
  const statusMap = new Map<string, number>();
  for (const r of reports) statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
  const reportsByStatus = [...statusMap.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);

  // severity distribution
  const sevMap = new Map<string, number>();
  for (const r of reports) sevMap.set(r.severity, (sevMap.get(r.severity) ?? 0) + 1);
  const severityDist = [...sevMap.entries()].map(([severity, count]) => ({ severity, count }));

  // recent reports table (5)
  const recent = reports.slice(0, 6);
  // enrich program names
  const progNameMap = new Map(progList.map((p) => [p.id, p.name] as const));
  // researcher display names
  const researcherIds = [...new Set(reports.map((r) => r.researcher_id))].slice(0, 30);
  const nameMap = new Map<string, string>();
  if (researcherIds.length) {
    const { data: rps } = await supabase.from('researcher_profiles').select('id,display_name').in('id', researcherIds);
    for (const rp of (rps ?? []) as { id: string; display_name: string }[]) nameMap.set(rp.id, rp.display_name);
  }

  // team activity: members + recent audits (best-effort, admin-only otherwise fallback to report creation)
  let members: { user_id: string; role: string; username: string }[] = [];
  if (companyIds.length) {
    const { data: mems } = await supabase
      .from('company_members')
      .select('user_id,role,profiles!inner(username)')
      .in('company_id', companyIds)
      .limit(30);
    members = ((mems ?? []) as unknown as { user_id: string; role: string; profiles: { username: string } }[]).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      username: m.profiles.username,
    }));
    // include owners if not in members
    const { data: owners } = await supabase.from('company_profiles').select('owner_id').in('id', companyIds);
    const ownerIds = [...new Set((owners ?? []).map((o: { owner_id: string }) => o.owner_id))];
    for (const oid of ownerIds) {
      if (!members.some((m) => m.user_id === oid)) {
        const { data: p } = await supabase.from('profiles').select('username').eq('id', oid).maybeSingle();
        if (p) members.unshift({ user_id: oid, role: 'owner', username: (p as { username: string }).username });
      }
    }
  }

  const teamActivity = reports.slice(0, 5).map((r) => ({
    id: r.id,
    actor: nameMap.get(r.researcher_id) ?? r.researcher_id.slice(0, 8),
    action: r.title,
    time: new Date(r.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
    status: r.status,
  }));

  return (
    <div className="py-2" dir="rtl">
      <PageHeader icon={Building2} title="لوحة الشركة" desc="برامجك وتقاريرك وأداء فرق الأمان — بيانات حية عبر Supabase" />

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="البرامج النشطة" value={activePrograms} icon={AppWindow} href="/company/programs" />
        <StatCard label="تقارير معلّقة" value={pendingReports} icon={Clock3} href="/company/reports" accent={pendingReports > 0} />
        <StatCard label="SLA معرّض للخطر" value={slaAtRisk} icon={AlertTriangle} href="/company/reports" accent={slaAtRisk > 0} />
        <StatCard
          label="إجمالي المكافآت المدفوعة"
          value={`${totalBountyPaid.toLocaleString('ar-EG')} EGP`}
          icon={Wallet}
          href="/company/payments"
          accent
        />
      </div>

      {/* companies row — keep existing */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-bold">شركاتي</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {uniqCompanies.map((c) => (
            <Card key={c.id} className="dark:border-slate-700 transition-colors hover:border-slate-400">
              <CardContent className="flex items-center justify-between p-4">
                <span className="font-bold">{c.name}</span>
                <Link href="/company/programs" className="text-xs underline">إدارة البرامج</Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <Card className="dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm">التقارير حسب الحالة</CardTitle>
            <CardDescription>Reports by Status — بيانات حية</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportsByStatusChart data={reportsByStatus} />
          </CardContent>
        </Card>
        <Card className="dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm">توزيع الخطورة</CardTitle>
            <CardDescription>Severity Distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanySeverityChart data={severityDist} />
          </CardContent>
        </Card>
      </div>

      {/* Recent reports + Team activity */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="dark:border-slate-700 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm">أحدث التقارير</CardTitle>
              <CardDescription>آخر {recent.length} تقارير على برامجك</CardDescription>
            </div>
            <Link href="/company/reports" className="text-xs text-muted-foreground hover:text-foreground">عرض الكل</Link>
          </CardHeader>
          <CardContent>
            {!recent.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">لا توجد تقارير بعد — ستظهر هنا عند تقديم الباحثين</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr className="text-right">
                      <th className="px-3 py-2 font-medium">الرقم</th>
                      <th className="px-3 py-2 font-medium">العنوان</th>
                      <th className="px-3 py-2 font-medium">البرنامج</th>
                      <th className="px-3 py-2 font-medium">الحالة</th>
                      <th className="px-3 py-2 font-medium">الخطورة</th>
                      <th className="px-3 py-2 font-medium">SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => {
                      const sla = getSLAStatus({ status: r.status, created_at: r.created_at, submitted_at: r.submitted_at } as never);
                      const slaColor = sla === 'overdue' ? 'text-red-600' : sla === 'at_risk' ? 'text-amber-600' : 'text-emerald-600';
                      return (
                        <tr key={r.id} className="border-t hover:bg-muted/40 dark:border-slate-800">
                          <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                            <Link href={`/company/reports/${r.id}`} className="hover:underline">{r.report_number}</Link>
                          </td>
                          <td className="max-w-[220px] truncate px-3 py-2 font-medium">
                            <Link href={`/company/reports/${r.id}`} className="hover:underline">{r.title}</Link>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{progNameMap.get(r.program_id) ?? '—'}</td>
                          <td className="px-3 py-2"><StatusPill value={r.status} /></td>
                          <td className="px-3 py-2"><StatusPill value={r.severity} kind="severity" /></td>
                          <td className={`px-3 py-2 text-xs font-bold ${slaColor}`}>{sla === 'fulfilled' ? 'منجز' : sla === 'pending' ? '—' : sla === 'overdue' ? 'متجاوز' : sla === 'at_risk' ? 'قارب' : 'ضمن المهلة'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4" /> نشاط الفريق</CardTitle>
            <CardDescription>أعضاء الشركة وآخر النشاطات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">الأعضاء ({members.length})</p>
              {!members.length ? (
                <p className="text-sm text-muted-foreground">لا أعضاء بعد</p>
              ) : (
                <ul className="space-y-1.5">
                  {members.slice(0, 6).map((m) => (
                    <li key={m.user_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm dark:border-slate-800">
                      <span className="font-medium">{m.username}</span>
                      <Badge variant="secondary" className="text-[11px] capitalize">{m.role}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/company/team" className="inline-block text-xs text-muted-foreground underline-offset-4 hover:underline">إدارة الفريق</Link>
            </div>

            <div className="space-y-2 border-t pt-4 dark:border-slate-800">
              <p className="text-xs font-semibold text-muted-foreground">آخر النشاطات</p>
              {!teamActivity.length ? (
                <p className="text-sm text-muted-foreground">لا نشاط بعد</p>
              ) : (
                <ul className="space-y-3">
                  {teamActivity.map((a) => (
                    <li key={a.id} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-semibold">{a.actor}</span>{' '}
                          <span className="text-muted-foreground">— {a.action}</span>
                        </p>
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          {a.time} <StatusPill value={a.status} />
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* quick links */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link href="/company/analytics" className="rounded-full border bg-card px-3 py-1.5 hover:bg-muted dark:border-slate-700">عرض التحليلات</Link>
        <Link href="/company/reports" className="rounded-full border bg-card px-3 py-1.5 hover:bg-muted dark:border-slate-700">صندوق الفرز</Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-muted-foreground"><FileText className="h-3 w-3" /> {reports.length} تقرير إجمالي</span>
      </div>
    </div>
  );
}

import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Building2,
  AppWindow,
  FileText,
  CreditCard,
  Scale,
  ShieldCheck,
  ScrollText,
  LifeBuoy,
  Settings as SettingsIcon,
  Gavel,
  AlertTriangle,
  Clock,
  Activity,
} from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReportsByStatusChart, ProgramsByStatusChart, SeverityChart, MonthlyReportsChart } from './_components/dashboard-charts';

export const dynamic = 'force-dynamic';

const labelArStatus: Record<string, string> = {
  draft: 'مسودة',
  pending_review: 'بانتظار المراجعة',
  active: 'نشط',
  paused: 'موقوف',
  closed: 'مغلق',
  submitted: 'مقدّم',
  triaged: 'مُفرز',
  accepted: 'مقبول',
  resolved: 'محلول',
  duplicate: 'مكرر',
  informative: 'معلوماتي',
  not_applicable: 'غير منطبق',
  pending: 'معلق',
  verified: 'موثّق',
  failed: 'فشل',
  open: 'مفتوح',
  under_review: 'قيد المراجعة',
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return d;
  }
}

export default async function AdminHome() {
  const supabase = await createServerClient();

  // Core counts
  const [
    usersCount,
    companiesCount,
    programsCount,
    reportsCount,
    domainPendingCount,
    companyVerifPendingCount,
    payoutPendingCount,
    disputesOpenCount,
    programsPendingCount,
    supportOpenCount,
    suspiciousOpenCount,
    appealsOpenCount,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).then((r) => r.count ?? 0),
    supabase.from('company_profiles').select('id', { count: 'exact', head: true }).then((r) => r.count ?? 0),
    supabase.from('programs').select('id', { count: 'exact', head: true }).then((r) => r.count ?? 0),
    supabase.from('reports').select('id', { count: 'exact', head: true }).then((r) => r.count ?? 0),
    supabase.from('domain_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending').then((r) => r.count ?? 0),
    supabase.from('company_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending').then((r) => r.count ?? 0),
    supabase.from('payout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').then((r) => r.count ?? 0),
    supabase.from('disputes').select('id', { count: 'exact', head: true }).in('status', ['open', 'under_review']).then((r) => r.count ?? 0),
    supabase.from('programs').select('id', { count: 'exact', head: true }).eq('status', 'pending_review').then((r) => r.count ?? 0),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open').then((r) => r.count ?? 0),
    supabase.from('suspicious_events').select('id', { count: 'exact', head: true }).eq('status', 'open').then((r) => r.count ?? 0),
    supabase.from('appeals').select('id', { count: 'exact', head: true }).eq('status', 'open').then((r) => r.count ?? 0),
  ]);

  const totalPendingVerification = domainPendingCount + companyVerifPendingCount;

  // Chart data
  const [{ data: reportRows }, { data: programRows }, { data: severityRows }, { data: monthlyRows }] = await Promise.all([
    supabase.from('reports').select('status').limit(5000),
    supabase.from('programs').select('status').limit(5000),
    supabase.from('reports').select('severity').limit(5000),
    supabase.from('reports').select('created_at').order('created_at', { ascending: true }).limit(5000),
  ]);

  const reportsByStatus = Object.entries(
    (reportRows ?? []).reduce<Record<string, number>>((acc, r: { status: string }) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: labelArStatus[name] ?? name, value }));

  const programsByStatus = Object.entries(
    (programRows ?? []).reduce<Record<string, number>>((acc, r: { status: string }) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: labelArStatus[name] ?? name, value }));

  const severityData = Object.entries(
    (severityRows ?? []).reduce<Record<string, number>>((acc, r: { severity: string }) => {
      acc[r.severity] = (acc[r.severity] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: labelArStatus[name] ?? name, value }));

  const monthlyMap: Record<string, number> = {};
  for (const r of (monthlyRows ?? []) as { created_at: string }[]) {
    const m = r.created_at.slice(0, 7);
    monthlyMap[m] = (monthlyMap[m] ?? 0) + 1;
  }
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([month, count]) => ({ month, count }));

  // Recent activity
  const [{ data: recentAudit }, { data: recentReports }, { data: recentModeration }] = await Promise.all([
    supabase.from('audit_logs').select('id,action,entity,entity_id,created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('reports').select('id,report_number,title,status,created_at').order('created_at', { ascending: false }).limit(6),
    supabase.from('moderation_actions').select('id,action,target_type,reason,created_at').order('created_at', { ascending: false }).limit(6),
  ]);

  const queueItems = [
    { label: 'نطاقات بالانتظار', count: domainPendingCount, href: '/admin/verification', icon: ShieldCheck, tone: domainPendingCount > 0 ? 'destructive' : 'secondary' },
    { label: 'توثيق شركات معلق', count: companyVerifPendingCount, href: '/admin/companies', icon: Building2, tone: companyVerifPendingCount > 0 ? 'destructive' : 'secondary' },
    { label: 'برامج بانتظار المراجعة', count: programsPendingCount, href: '/admin/programs?status=pending_review', icon: AppWindow, tone: programsPendingCount > 0 ? 'destructive' : 'secondary' },
    { label: 'نزاعات مفتوحة', count: disputesOpenCount, href: '/admin/disputes', icon: Scale, tone: disputesOpenCount > 0 ? 'destructive' : 'secondary' },
    { label: 'طلبات سحب معلقة', count: payoutPendingCount, href: '/admin/payments', icon: CreditCard, tone: payoutPendingCount > 0 ? 'destructive' : 'secondary' },
    { label: 'تذاكر دعم مفتوحة', count: supportOpenCount, href: '/admin/support', icon: LifeBuoy, tone: supportOpenCount > 0 ? 'destructive' : 'secondary' },
    { label: 'أحداث مشبوهة', count: suspiciousOpenCount, href: '/admin/verification', icon: AlertTriangle, tone: suspiciousOpenCount > 0 ? 'destructive' : 'secondary' },
    { label: 'استئنافات', count: appealsOpenCount, href: '/admin/verification', icon: Gavel, tone: appealsOpenCount > 0 ? 'destructive' : 'secondary' },
  ] as const;

  return (
    <div className="space-y-6 py-2" dir="rtl">
      <PageHeader icon={LayoutDashboard} title="لوحة الإدارة" desc="نظرة شاملة — الإحصائيات، الرسوم البيانية، طوابير الإشراف والنشاط الأخير" />

      {/* Primary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="إجمالي المستخدمين" value={usersCount} icon={Users} href="/admin/users" />
        <StatCard label="الشركات" value={companiesCount} icon={Building2} href="/admin/companies" />
        <StatCard label="البرامج" value={programsCount} icon={AppWindow} href="/admin/programs" />
        <StatCard label="التقارير" value={reportsCount} icon={FileText} href="/admin/reports" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="بانتظار التوثيق" value={totalPendingVerification} icon={ShieldCheck} accent href="/admin/verification" />
        <StatCard label="برامج قيد المراجعة" value={programsPendingCount} icon={Clock} href="/admin/programs?status=pending_review" />
        <StatCard label="طلبات سحب معلقة" value={payoutPendingCount} icon={CreditCard} href="/admin/payments" />
        <StatCard label="نزاعات مفتوحة" value={disputesOpenCount} icon={Scale} href="/admin/disputes" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">التقارير حسب الحالة</CardTitle>
            <CardDescription>توزيع حالات التقارير في المنصة</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportsByStatusChart data={reportsByStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">البرامج حسب الحالة</CardTitle>
            <CardDescription>حالات البرامج الحالية</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgramsByStatusChart data={programsByStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">التقارير حسب الخطورة</CardTitle>
          </CardHeader>
          <CardContent>
            <SeverityChart data={severityData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">التقارير الشهرية</CardTitle>
            <CardDescription>آخر 8 أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyReportsChart data={monthlyData} />
          </CardContent>
        </Card>
      </div>

      {/* Moderation queues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> طوابير الإشراف
          </CardTitle>
          <CardDescription>أرقام تحتاج تدخلاً — اضغط للانتقال للطابور</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {queueItems.map((q) => (
              <Link
                key={q.label}
                href={q.href}
                className="flex items-center justify-between rounded-xl border p-3 transition-colors hover:border-slate-400 hover:bg-accent dark:hover:bg-accent/50"
              >
                <span className="flex items-center gap-2 text-xs font-bold">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <q.icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  {q.label}
                </span>
                <Badge variant={q.count > 0 ? 'destructive' : 'secondary'}>{q.count}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent activity feed */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">آخر سجلات التدقيق</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentAudit?.length ? (
              <p className="text-sm text-muted-foreground">لا يوجد نشاط بعد.</p>
            ) : (
              <ul className="space-y-2">
                {recentAudit.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 rounded-lg border p-2 text-xs">
                    <span>
                      <b>{a.action}</b> — {a.entity}
                      <span className="block font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {a.entity_id?.slice(0, 8) ?? '-'}
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground">{formatDate(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/audit-logs" className="mt-3 inline-block text-xs font-bold underline-offset-4 hover:underline">
              عرض سجل التدقيق →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">أحدث التقارير</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentReports?.length ? (
              <p className="text-sm text-muted-foreground">لا يوجد.</p>
            ) : (
              <ul className="space-y-2">
                {recentReports.map((r) => (
                  <li key={r.id} className="rounded-lg border p-2">
                    <p className="truncate text-xs font-bold" dir="ltr">
                      {r.report_number} — {r.title}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-2">
                      <Badge variant="secondary">{labelArStatus[r.status] ?? r.status}</Badge>
                      <span className="text-[11px] text-muted-foreground">{formatDate(r.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/reports" className="mt-3 inline-block text-xs font-bold underline-offset-4 hover:underline">
              إدارة التقارير →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">آخر إجراءات الإشراف</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentModeration?.length ? (
              <p className="text-sm text-muted-foreground">لا يوجد.</p>
            ) : (
              <ul className="space-y-2">
                {recentModeration.map((m) => (
                  <li key={m.id} className="rounded-lg border p-2 text-xs">
                    <span className="font-bold">
                      {m.action} — {m.target_type}
                    </span>
                    <span className="block truncate text-muted-foreground">{m.reason ?? '—'}</span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(m.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/moderation" className="mt-3 inline-block text-xs font-bold underline-offset-4 hover:underline">
              سجل الإشراف →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { href: '/admin/users', label: 'المستخدمون', Icon: Users },
          { href: '/admin/companies', label: 'الشركات', Icon: Building2 },
          { href: '/admin/programs', label: 'البرامج', Icon: AppWindow },
          { href: '/admin/reports', label: 'التقارير', Icon: FileText },
          { href: '/admin/payments', label: 'المدفوعات', Icon: CreditCard },
          { href: '/admin/disputes', label: 'النزاعات', Icon: Scale },
          { href: '/admin/verification', label: 'التحقق', Icon: ShieldCheck },
          { href: '/admin/moderation', label: 'الإشراف', Icon: Gavel },
          { href: '/admin/audit-logs', label: 'التدقيق', Icon: ScrollText },
          { href: '/admin/support', label: 'الدعم', Icon: LifeBuoy },
          { href: '/admin/settings', label: 'الإعدادات', Icon: SettingsIcon },
        ].map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-slate-400 hover:bg-accent dark:hover:bg-accent/50">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="text-sm font-bold">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

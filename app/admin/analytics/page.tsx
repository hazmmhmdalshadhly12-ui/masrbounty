import Link from 'next/link';
import { requireStaff } from '@/lib/auth/admin-actions';
import { createServerClient } from '@/lib/supabase/server';
import { buildRangeWindow, countBy, parseAnalyticsRange, sumNumeric, ANALYTICS_RANGES } from '@/lib/analytics/range';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReportsByStatusChart, SeverityChart } from '@/app/admin/_components/dashboard-charts';
import { SignupsTrendChart } from './_components/analytics-charts';
import { BarChart3, Users, FileText, Coins, Rocket, AlertCircle as AlertIcon } from 'lucide-react';
import { fmtEGP } from '@/utils/format';

export const dynamic = 'force-dynamic';

const REPORT_STATUS_AR: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'مُقدَّم',
  triaged: 'مُصنَّف',
  informative: 'استفساري',
  duplicate: 'مكرر',
  not_applicable: 'غير قابل للتطبيق',
  accepted: 'مقبول',
  resolved: 'مُحلول',
  closed: 'مغلق',
};

const SEVERITY_AR: Record<string, string> = {
  informational: 'استعلامي',
  low: 'منخفض',
  medium: 'متوسط',
  high: 'مرتفع',
  critical: 'حرج',
};

const REPORT_STATUSES = ['draft', 'submitted', 'triaged', 'informative', 'duplicate', 'not_applicable', 'accepted', 'resolved', 'closed'] as const;
const SEVERITIES = ['informational', 'low', 'medium', 'high', 'critical'] as const;

export default async function AdminAnalytics({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  // Read-only analytics: staff-wide (admin + moderator).
  await requireStaff(['admin', 'moderator']);
  const { range: rangeParam } = await searchParams;
  const range = parseAnalyticsRange(rangeParam);
  const win = buildRangeWindow(range);
  const supabase = await createServerClient();

  const [signupsR, reportsR, awardsAll, usersTotal, companiesTotal, programsActive, reportsTotal] = await Promise.all([
    supabase.from('profiles').select('created_at').gte('created_at', win.gte).lt('created_at', win.lt).limit(10000),
    supabase
      .from('reports')
      .select('status,severity,bounty_amount,submitted_at,title,report_number')
      .gte('submitted_at', win.gte)
      .lt('submitted_at', win.lt)
      .order('submitted_at', { ascending: false })
      .limit(10000),
    supabase.from('bounty_awards').select('amount,status,decided_at').eq('status', 'paid').limit(10000),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('company_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('programs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('reports').select('id', { count: 'exact', head: true }),
  ]);

  const signups = (signupsR.data ?? []) as Array<{ created_at: string }>;
  const reports = (reportsR.data ?? []) as Array<{ status: string; severity: string; bounty_amount: unknown; submitted_at: string; title: string; report_number: string }>;
  const awards = (awardsAll.data ?? []) as Array<{ amount: unknown; status: string; decided_at: string | null }>;

  // per-day buckets for the signup trend
  const trend = win.dayBuckets.map((b) => ({
    label: b.label,
    count: signups.filter((s) => s.created_at >= b.gte && s.created_at < b.lt).length,
  }));

  const statusCounts = countBy(reports, 'status', REPORT_STATUSES);
  const severityCounts = countBy(reports, 'severity', SEVERITIES);
  const paidInWindow = awards.filter((a) => a.decided_at && a.decided_at >= win.gte && a.decided_at < win.lt);
  const paidTotal = sumNumeric(paidInWindow, 'amount');
  const acceptedInWindow = reports.filter((r) => r.status === 'accepted' || r.status === 'resolved').length;

  const reportsCsv = reports.slice(0, 1000).map((r) => ({
    report_number: r.report_number,
    title: r.title,
    status: REPORT_STATUS_AR[r.status] ?? r.status,
    severity: SEVERITY_AR[r.severity] ?? r.severity,
    bounty_amount: String(r.bounty_amount ?? ''),
    submitted_at: r.submitted_at?.slice(0, 10) ?? '',
  }));

  return (
    <div className="space-y-6 py-2" dir="rtl">
      <PageHeader icon={BarChart3} title="التقارير والتحليلات" desc="مؤشرات المنصة خلال مدى زمني قابل للاختيار — مع تصدير CSV" />

      {/* Range filter — instant navigation links (server-driven) */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <span className="text-sm font-bold">المدى الزمني:</span>
          {ANALYTICS_RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/analytics?range=${r}`}
              aria-current={r === range ? 'page' : undefined}
              className={[
                'min-h-[36px] cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                r === range ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:border-slate-400 dark:hover:border-slate-500',
              ].join(' ')}
            >
              آخر {r} يوم
            </Link>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <AlertIcon className="h-3 w-3" /> {win.gte.slice(0, 10)} ← {win.lt.slice(0, 10)}
            </Badge>
          </span>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`مستخدمون جدد (${range} يوم)`} value={signups.length} icon={Users} />
        <StatCard label={`تقارير جديدة (${range} يوم)`} value={reports.length} icon={FileText} accent />
        <StatCard label="مكافآت مدفوعة" value={fmtEGP(paidTotal)} icon={Coins} />
        <StatCard label="برامج نشطة" value={programsActive.count ?? 0} icon={Rocket} href="/admin/programs" />
      </div>

      {/* Context strip */}
      <p className="text-xs text-muted-foreground">
        إجمالي المنصة حتى اليوم: {usersTotal.count ?? 0} مستخدم · {companiesTotal.count ?? 0} شركة · {reportsTotal.count ?? 0} تقرير · نسبة القبول خلال المدى:{' '}
        {reports.length ? Math.round((acceptedInWindow / reports.length) * 100) : 0}%
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">نمو الاشتراكات يوميًا</CardTitle>
            <CardDescription>حسابات جديدة خلال آخر {range} يوم</CardDescription>
          </CardHeader>
          <CardContent>
            <SignupsTrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">التقارير حسب الحالة</CardTitle>
            <CardDescription>توزيع حالات التقارير المقدمة خلال المدى</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportsByStatusChart
              data={REPORT_STATUSES.map((s) => ({ name: REPORT_STATUS_AR[s], value: statusCounts[s] })).filter((d) => d.value > 0)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">الخطورة</CardTitle>
            <CardDescription>توزيع درجات خطورة تقارير المدى</CardDescription>
          </CardHeader>
          <CardContent>
            <SeverityChart data={SEVERITIES.map((s) => ({ name: SEVERITY_AR[s], value: severityCounts[s] })).filter((d) => d.value > 0)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">تصدير البيانات</CardTitle>
              <CardDescription>أول 1000 صف من تقارير المدى</CardDescription>
            </div>
            <ExportButton rows={reportsCsv} filename={`masrbounty-reports-${range}d.csv`} />
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-inside list-disc space-y-1">
              <li>الأعمدة: رقم التقرير، العنوان، الحالة، الخطورة، المكافأة، تاريخ الإرسال.</li>
              <li>الملف بترميز UTF-8 — يفتح مباشرة في Excel/Sheets.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

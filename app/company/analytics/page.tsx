import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCompanyAnalytics } from '@/services/analytics';
import {
  ReportsPerMonthChart,
  SeverityDistChart,
  BountySpendingChart,
  AvgResolutionChart,
} from '@/components/company/analytics-charts';

export default async function AnalyticsPage() {
  const { data: analytics, error } = await getCompanyAnalytics();

  if (error || !analytics) {
    return (
      <main className="container py-8">
        <h1 className="text-2xl font-bold mb-2">التحليلات</h1>
        <p className="text-sm text-muted-foreground mb-6">لوحة تحليلات الشركة — التقارير، الخطورة، الإنفاق، زمن الحل، وأفضل الباحثين</p>
        <Card className="dark:border-slate-700"><CardContent className="p-6 text-sm text-destructive">تعذر تحميل التحليلات: {error ?? 'غير معروف'}</CardContent></Card>
      </main>
    );
  }

  const { reportsPerMonth, severityDistribution, bountySpending, avgResolutionTime, topResearchers, totals } = analytics;

  return (
    <main className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">التحليلات</h1>
        <p className="mt-1 text-sm text-muted-foreground">لوحة تحليلات الشركة — عبر services/analytics.ts (RLS-aware) — آمنة للوضع الداكن</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="dark:border-slate-700"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">إجمالي التقارير</CardTitle></CardHeader><CardContent className="text-2xl font-black tabular-nums" dir="ltr">{totals.reports}</CardContent></Card>
        <Card className="dark:border-slate-700"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">تقارير محلولة</CardTitle></CardHeader><CardContent className="text-2xl font-black tabular-nums" dir="ltr">{totals.resolved}</CardContent></Card>
        <Card className="dark:border-slate-700"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">إجمالي المكافآت</CardTitle></CardHeader><CardContent className="text-2xl font-black tabular-nums" dir="ltr">{Number(totals.totalBounty).toLocaleString()} EGP</CardContent></Card>
        <Card className="dark:border-slate-700"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">متوسط زمن الحل</CardTitle></CardHeader><CardContent className="text-2xl font-black tabular-nums" dir="ltr">{totals.avgResolutionHours} ساعة</CardContent></Card>
      </div>

      {/* Row 1: Reports/Month + Severity */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
        <Card className="dark:border-slate-700">
          <CardHeader><CardTitle className="text-sm">التقارير حسب الشهر</CardTitle><CardDescription>Reports / Month</CardDescription></CardHeader>
          <CardContent><ReportsPerMonthChart data={reportsPerMonth} /></CardContent>
        </Card>
        <Card className="dark:border-slate-700">
          <CardHeader><CardTitle className="text-sm">توزيع الخطورة</CardTitle><CardDescription>Severity Distribution</CardDescription></CardHeader>
          <CardContent><SeverityDistChart data={severityDistribution} /></CardContent>
        </Card>
      </div>

      {/* Row 2: Bounty Spending + Avg Resolution */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
        <Card className="dark:border-slate-700">
          <CardHeader><CardTitle className="text-sm">إنفاق المكافآت حسب الشهر</CardTitle><CardDescription>Bounty Spending (EGP)</CardDescription></CardHeader>
          <CardContent><BountySpendingChart data={bountySpending} /></CardContent>
        </Card>
        <Card className="dark:border-slate-700">
          <CardHeader><CardTitle className="text-sm">متوسط زمن الحل (ساعة)</CardTitle><CardDescription>Avg Resolution Time — per month</CardDescription></CardHeader>
          <CardContent><AvgResolutionChart data={avgResolutionTime} /></CardContent>
        </Card>
      </div>

      {/* Top Researchers */}
      <Card className="dark:border-slate-700">
        <CardHeader><CardTitle className="text-sm">أفضل الباحثين (Top Researchers)</CardTitle><CardDescription>حسب عدد التقارير وإجمالي المكافآت — من نفس مجموعة التقارير (RLS-aware)</CardDescription></CardHeader>
        <CardContent>
          {!topResearchers.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا يوجد باحثون بعد</p>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain rounded-lg border" tabIndex={0} aria-label="جدول أفضل الباحثين — اسحب أفقيًا على الجوال">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="text-start">
                    <th scope="col" className="px-3 py-2 font-medium text-start">#</th>
                    <th scope="col" className="px-3 py-2 font-medium text-start">الباحث</th>
                    <th scope="col" className="px-3 py-2 font-medium text-start">التقارير</th>
                    <th scope="col" className="px-3 py-2 font-medium text-start">إجمالي المكافآت</th>
                  </tr>
                </thead>
                <tbody>
                  {topResearchers.map((r, i) => (
                    <tr key={r.researcher_id} className="border-t hover:bg-muted/40">
                      <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 font-medium" dir="ltr">{r.display_name}</td>
                      <td className="px-3 py-2 tabular-nums" dir="ltr">{r.reports}</td>
                      <td className="px-3 py-2 tabular-nums" dir="ltr">{Number(r.total_earned).toLocaleString()} EGP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {bountySpending.length ? <Badge variant="secondary">إنفاق {bountySpending.length} شهرًا</Badge> : null}
            {reportsPerMonth.length ? <Badge variant="secondary">{reportsPerMonth.length} شهر تقارير</Badge> : null}
            {avgResolutionTime.length ? <Badge variant="outline">متوسط {totals.avgResolutionHours}س</Badge> : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

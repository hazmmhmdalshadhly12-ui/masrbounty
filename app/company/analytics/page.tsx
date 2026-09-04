import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportsChart } from '@/components/charts/reports-chart';
import { SeverityChart } from '@/components/charts/severity-chart';

export default async function AnalyticsPage() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('program_stats_view').select('*');
  const { data: reports } = await supabase.from('reports').select('status,severity').limit(1000);
  const byStatus = Object.entries(((reports ?? []) as { status: string }[]).reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {})).map(([status, count]) => ({ status, count }));
  const bySeverity = Object.entries(((reports ?? []) as { severity: string }[]).reduce<Record<string, number>>((a, r) => ({ ...a, [r.severity]: (a[r.severity] ?? 0) + 1 }), {})).map(([severity, count]) => ({ severity, count }));
  const totals = (data ?? []).reduce((a: { reports: number; resolved: number }, s: { total_reports: number; resolved_reports: number }) => ({ reports: a.reports + Number(s.total_reports), resolved: a.resolved + Number(s.resolved_reports) }), { reports: 0, resolved: 0 });
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">التحليلات</h1>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Card><CardHeader><CardTitle className="text-sm">Total reports</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.reports}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Resolved</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.resolved}</CardContent></Card>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card><CardHeader><CardTitle className="text-sm">By status</CardTitle></CardHeader><CardContent><ReportsChart data={byStatus} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">By severity</CardTitle></CardHeader><CardContent><SeverityChart data={bySeverity} /></CardContent></Card>
      </div>
      {!data?.length ? <p className="text-muted-foreground">No data.</p> : data.map((s: { program_id: string; name: string; total_reports: number; new_reports: number; resolved_reports: number; total_bounty: number }) => (
        <Card key={s.program_id} className="mb-2"><CardContent className="p-3 text-sm">{s.name}: {s.total_reports} total / {s.new_reports} new / {s.resolved_reports} resolved / {s.total_bounty} EGP</CardContent></Card>
      ))}
    </main>
  );
}

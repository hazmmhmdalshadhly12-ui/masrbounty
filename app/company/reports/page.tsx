import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/shared/status-pill';

const STATUSES = ['', 'submitted', 'triaged', 'accepted', 'resolved', 'duplicate', 'closed'];
const SEVERITIES = ['', 'critical', 'high', 'medium', 'low', 'informational'];

export default async function CompanyReports({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string; q?: string }> }) {
  const { status = '', severity = '', q = '' } = await searchParams;
  const supabase = await createServerClient();
  let query = supabase.from('report_overview').select('*').order('created_at', { ascending: false }).limit(100);
  if (status) query = query.eq('status', status);
  if (severity) query = query.eq('severity', severity);
  if (q.trim()) query = query.ilike('title', `%${q.trim()}%`);
  const { data: reports } = await query;
  return (
    <div className="py-2">
      <div className="mb-5">
        <h1 className="text-xl font-black tracking-tight">التقارير الواردة</h1>
        <p className="mt-1 text-sm text-muted-foreground">{reports?.length ?? 0} تقريرًا على برامجك</p>
        <form className="mt-3 flex flex-wrap gap-2">
          <Input name="q" defaultValue={q} placeholder="بحث بالعنوان…" className="h-9 w-48" />
          <select name="status" defaultValue={status} className="h-9 rounded-md border px-2 text-sm">
            <option value="">كل الحالات</option>
            {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select name="severity" defaultValue={severity} className="h-9 rounded-md border px-2 text-sm">
            <option value="">كل الخطورة</option>
            {SEVERITIES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button size="sm" variant="outline" type="submit">فلترة</Button>
        </form>
      </div>
      {!reports?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center p-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-bold">لا توجد تقارير</p>
            <p className="mt-1 text-sm text-muted-foreground">تظهر هنا التقارير المُقدمة على برامج شركتك فقط.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">الرقم</th>
                  <th className="px-4 py-3 font-medium">العنوان</th>
                  <th className="px-4 py-3 font-medium">الباحث</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">الخطورة</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r: { id: string; report_number: string; title: string; status: string; severity: string; researcher_name: string }) => (
                  <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs" dir="ltr">{r.report_number}</td>
                    <td className="px-4 py-3">
                      <Link href={`/company/reports/${r.id}`} className="font-medium hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.researcher_name}</td>
                    <td className="px-4 py-3"><StatusPill value={r.status} /></td>
                    <td className="px-4 py-3"><StatusPill value={r.severity} kind="severity" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPill } from '@/components/shared/status-pill';

export default async function CompanyReports() {
  const supabase = await createServerClient();
  const { data: reports } = await supabase.from('report_overview').select('*').order('created_at', { ascending: false }).limit(100);
  return (
    <div className="py-2">
      <div className="mb-5">
        <h1 className="text-xl font-black tracking-tight">التقارير الواردة</h1>
        <p className="mt-1 text-sm text-muted-foreground">{reports?.length ?? 0} تقريرًا على برامجك</p>
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

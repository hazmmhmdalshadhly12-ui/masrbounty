import Link from 'next/link';
import { Plus, Inbox } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/shared/status-pill';

export default async function ReportsPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return (
      <main className="py-2">
        <p className="text-sm">سجّل الدخول أولًا من <Link href="/login" className="underline">هنا</Link>.</p>
      </main>
    );
  }
  const { data: rp } = await supabase
    .from('researcher_profiles')
    .select('id')
    .eq('user_id', user.user.id)
    .single();
  if (!rp) return <main className="py-2 text-sm text-muted-foreground">لا يوجد ملف باحث مرتبط بحسابك.</main>;
  const { data: reports } = await supabase
    .from('reports')
    .select('id,report_number,title,status,severity,bounty_amount,created_at')
    .eq('researcher_id', rp.id)
    .order('created_at', { ascending: false });

  return (
    <div className="py-2">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight">التقارير</h1>
          <p className="mt-1 text-sm text-muted-foreground">{reports?.length ?? 0} تقريرًا — آخر نشاط أولًا</p>
        </div>
        <Link href="/dashboard/reports/new">
          <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-700">
            <Plus className="h-4 w-4" /> تقرير جديد
          </Button>
        </Link>
      </div>
      {!reports?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center p-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-bold">لا توجد تقارير بعد</p>
            <p className="mt-1 text-sm text-muted-foreground">أنشئ مسودتك الأولى وستظهر هنا.</p>
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
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">الخطورة</th>
                  <th className="px-4 py-3 font-medium">المكافأة</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs" dir="ltr">{r.report_number}</td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/reports/${r.id}`} className="font-medium hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusPill value={r.status} /></td>
                    <td className="px-4 py-3"><StatusPill value={r.severity} kind="severity" /></td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">{r.bounty_amount ?? 0}</td>
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

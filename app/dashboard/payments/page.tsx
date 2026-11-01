import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/shared/status-pill';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Banknote, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type AwardRow = {
  id: string;
  amount: number | string;
  status: string;
  created_at: string;
  reports: { report_number: string; title: string } | null;
};

type PayoutRow = {
  id: string;
  amount: number | string;
  status: string;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

const fmt = (n: number | string) => Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const dt = (s: string) => new Date(s).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

export default async function PaymentsPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="container py-12">Login required.</div>;
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) {
    return (
      <div className="container py-8">
        <PageHeader icon={Banknote} title="المدفوعات" desc="المكافآت المعتمدة وطلبات السحب." />
        <EmptyState
          title="لا يوجد ملف باحث مرتبط بحسابك"
          hint="أنشئ ملف الباحث أولًا لتصلك مكافآت الثغرات المقبولة."
        />
      </div>
    );
  }

  const [{ data: awards }, { data: payouts }] = await Promise.all([
    supabase
      .from('bounty_awards')
      .select('id,amount,status,created_at,reports!inner(report_number,title,researcher_id)')
      .eq('reports.researcher_id', rp.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('payout_requests')
      .select('id,amount,status,review_note,created_at,updated_at')
      .eq('researcher_id', rp.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const awardRows = (awards ?? []) as unknown as AwardRow[];
  const payoutRows = (payouts ?? []) as unknown as PayoutRow[];
  const approvedTotal = awardRows
    .filter((a) => a.status === 'approved' || a.status === 'paid')
    .reduce((s, a) => s + Number(a.amount), 0);

  return (
    <div className="container py-8 space-y-6" dir="rtl">
      <PageHeader
        icon={Banknote}
        title="المدفوعات"
        desc="سجل كامل بالمكافآت المعتمدة وطلبات سحب الأرباح."
        action={
          <p className="text-sm text-muted-foreground">
            إجمالي المكافآت المعتمدة:{' '}
            <b className="tabular-nums text-foreground" dir="ltr">
              {fmt(approvedTotal)} EGP
            </b>
          </p>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Banknote className="h-4 w-4" /> مكافآت الثغرات (Bounty awards)
          </CardTitle>
          <CardDescription>كل مكافأة معتمدة على أحد تقاريرك — الصرف يتم عبر المحفظة.</CardDescription>
        </CardHeader>
        <CardContent>
          {!awardRows.length ? (
            <EmptyState
              title="لا توجد مكافآت بعد"
              hint="عند قبول شركة لأحد تقاريرك ومنح مكافأة، ستظهر هنا فورًا."
              action={
                <Link href="/dashboard/reports/new" className="text-sm font-medium underline underline-offset-4">
                  أرسل تقريرك الأول
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="text-right">
                    <th className="px-3 py-2 font-medium">التقرير</th>
                    <th className="px-3 py-2 font-medium">المبلغ</th>
                    <th className="px-3 py-2 font-medium">الحالة</th>
                    <th className="px-3 py-2 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {awardRows.map((a) => (
                    <tr key={a.id} className="border-t dark:border-slate-800 hover:bg-muted/40">
                      <td className="max-w-[280px] px-3 py-2">
                        <p className="truncate font-medium">{a.reports?.title ?? '—'}</p>
                        <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                          {a.reports?.report_number ?? ''}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-bold tabular-nums" dir="ltr">
                        {fmt(a.amount)} EGP
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill value={a.status} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{dt(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" /> طلبات السحب (Payouts)
          </CardTitle>
          <CardDescription>طلبات تحويل رصيدك المتاح إلى وسيلة الدفع المرتبطة بحسابك.</CardDescription>
        </CardHeader>
        <CardContent>
          {!payoutRows.length ? (
            <EmptyState
              title="لا توجد طلبات سحب"
              hint="يمكنك طلب سحب رصيدك من صفحة المحفظة في أي وقت."
              action={
                <Link href="/dashboard/wallet" className="text-sm font-medium underline underline-offset-4">
                  الذهاب إلى المحفظة
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="text-right">
                    <th className="px-3 py-2 font-medium">المبلغ</th>
                    <th className="px-3 py-2 font-medium">الحالة</th>
                    <th className="px-3 py-2 font-medium">ملاحظة المراجعة</th>
                    <th className="px-3 py-2 font-medium">تاريخ الطلب</th>
                    <th className="px-3 py-2 font-medium">آخر تحديث</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutRows.map((p) => (
                    <tr key={p.id} className="border-t dark:border-slate-800 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-3 py-2 font-bold tabular-nums" dir="ltr">
                        {fmt(p.amount)} EGP
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill value={p.status} />
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">{p.review_note ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{dt(p.created_at)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{dt(p.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { createServerClient } from '@/lib/supabase/server';
import { markPaidAction } from '@/features/company/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default async function CompanyPayments() {
  const supabase = await createServerClient();
  const [{ data: awards }, { data: vfRow }] = await Promise.all([
    supabase
      .from('bounty_awards')
      .select('id,amount,status,created_at,report_id,bounty_payments(reference)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('platform_settings').select('value').eq('key', 'vf_cash_number').single(),
  ]);
  const due = ((awards ?? []) as { amount: number; status: string }[])
    .filter((a) => a.status === 'approved')
    .reduce((s, a) => s + Number(a.amount), 0);
  const vfNumber = String((vfRow?.value as string | null) ?? '0112417443').replace(/"/g, '');
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">المدفوعات</h1>
      <Card className="mb-6 border-amber-400/60">
        <CardHeader><CardTitle>تمويل المنصة (ضمان)</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>المستحق عليك حاليًا: <b className="tabular-nums" dir="ltr">{due.toLocaleString()} EGP</b></p>
          <p>حوّل المبلغ من فودافون كاش إلى رقم المنصة <b className="font-mono" dir="ltr">{vfNumber}</b>، ثم أبلغ الإدارة لتعتمد التمويل وتدفع للباحث.</p>
          <p className="text-xs text-muted-foreground">لا يصل المبلغ للباحث إلا بعد تأكيد الإدارة استلام تحويلك — هكذا يحمي الضمان الطرفين.</p>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>المكافآت الممنوحة ({awards?.length ?? 0})</CardTitle></CardHeader><CardContent>
        {!awards?.length ? <p className="text-sm text-muted-foreground">None.</p> : awards.map((a: { id: string; amount: number; status: string; bounty_payments: { reference: string | null }[] }) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm">
            <span>{a.amount} EGP — <Badge>{a.status}</Badge>
              {a.bounty_payments?.[0]?.reference && <span className="ml-2 text-muted-foreground" dir="ltr">ref: {a.bounty_payments[0].reference}</span>}
            </span>
            {a.status !== 'paid' && (
              <form action={markPaidAction.bind(null, a.id)} className="flex gap-2">
                <Input name="reference" required maxLength={120} placeholder="مرجع التحويل" dir="ltr" className="h-9 w-44" />
                <Button size="sm" type="submit">تم الدفع</Button>
              </form>
            )}
          </div>
        ))}
      </CardContent></Card>
    </main>
  );
}

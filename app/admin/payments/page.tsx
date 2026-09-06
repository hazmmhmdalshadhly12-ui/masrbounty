import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { approvePayoutAction } from '@/features/disputes/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

async function setFee(formData: FormData) {
  'use server';
  const pct = Number(formData.get('percent'));
  if (!(pct >= 0 && pct <= 50)) throw new Error('Fee must be 0–50%');
  const supabase = await createServerClient();
  await supabase.from('platform_settings').upsert({ key: 'platform_fee', value: { percent: pct } });
  revalidatePath('/admin/payments');
}

export default async function AdminPayments() {
  const supabase = await createServerClient();
  const [{ data }, { data: revenue }, { data: feeRow }] = await Promise.all([
    supabase.from('payout_requests').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('platform_revenue').select('gross_amount,fee_amount,net_amount'),
    supabase.from('platform_settings').select('value').eq('key', 'platform_fee').single(),
  ]);
  const totals = ((revenue ?? []) as { gross_amount: number; fee_amount: number; net_amount: number }[]).reduce(
    (a, r) => ({ gross: a.gross + Number(r.gross_amount), fee: a.fee + Number(r.fee_amount), net: a.net + Number(r.net_amount) }),
    { gross: 0, fee: 0, net: 0 }
  );
  const feePct = Number((feeRow?.value as { percent?: number } | null)?.percent ?? 10);
  return (
    <div className="py-2">
      <h1 className="mb-6 text-xl font-black tracking-tight">المدفوعات وإيراد المنصة</h1>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          ['إجمالي المكافآت', totals.gross],
          ['عمولة المنصة', totals.fee],
          ['صافي الباحثين', totals.net],
        ].map(([label, v]) => (
          <Card key={label as string}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black tabular-nums" dir="ltr">{Number(v).toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label} (EGP)</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mb-6">
        <CardHeader><CardTitle>عمولة المنصة الحالية: {feePct}%</CardTitle></CardHeader>
        <CardContent>
          <form action={setFee} className="flex gap-2">
            <Input name="percent" type="number" min={0} max={50} step={0.5} defaultValue={feePct} dir="ltr" className="w-32" />
            <Button size="sm" type="submit">حفظ (0–50%)</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">تُخصم تلقائيًا من كل مكافأة جديدة وتُسجل في دفتر الإيراد. الباحث يرى الصافي فقط.</p>
        </CardContent>
      </Card>
      <h2 className="mb-3 font-bold">طلبات السحب ({data?.length ?? 0})</h2>
      {!data?.length ? <p className="text-sm text-muted-foreground">No payout requests.</p> : data.map((p) => (
        <Card key={p.id} className="mb-2"><CardContent className="p-3 flex justify-between items-center">
          <span className="text-sm">{p.amount} EGP — <Badge>{p.status}</Badge></span>
          {p.status === 'pending' && (
            <span className="flex gap-2">
              <form action={approvePayoutAction.bind(null, p.id, true)}><Button size="sm" type="submit">Approve</Button></form>
              <form action={approvePayoutAction.bind(null, p.id, false)}><Button size="sm" variant="outline" type="submit">Reject</Button></form>
            </span>
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}

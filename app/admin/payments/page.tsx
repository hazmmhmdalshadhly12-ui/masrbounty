import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { approvePayoutAction, completePayoutAction } from '@/features/disputes/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/shared/status-pill';

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Unauthorized');
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', me.user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === 'admin')) throw new Error('للإدارة فقط');
  return supabase;
}

async function setFee(formData: FormData) {
  'use server';
  const pct = Number(formData.get('percent'));
  if (!(pct >= 0 && pct <= 50)) throw new Error('Fee must be 0–50%');
  const supabase = await requireAdmin();
  await supabase.from('platform_settings').upsert({ key: 'platform_fee', value: { percent: pct } });
  revalidatePath('/admin/payments');
}

const STEPS: Record<string, string> = {
  pending: 'بانتظار تأكيد تمويل الشركة للمنصة',
  approved: 'مموّل — بانتظار التحويل للباحث',
  processing: 'قيد التنفيذ',
  completed: 'مكتمل',
  rejected: 'مرفوض',
  failed: 'فاشل',
};

export default async function AdminPayments() {
  const supabase = await requireAdmin();
  const [{ data }, { data: revenue }, { data: feeRow }, { data: vfRow }] = await Promise.all([
    supabase.from('payout_requests').select('*,payment_methods!fk_payout_method(label,type)').order('created_at', { ascending: false }).limit(100),
    supabase.from('platform_revenue').select('gross_amount,fee_amount,net_amount'),
    supabase.from('platform_settings').select('value').eq('key', 'platform_fee').single(),
    supabase.from('platform_settings').select('value').eq('key', 'vf_cash_number').single(),
  ]);
  const totals = ((revenue ?? []) as { gross_amount: number; fee_amount: number; net_amount: number }[]).reduce(
    (a, r) => ({ gross: a.gross + Number(r.gross_amount), fee: a.fee + Number(r.fee_amount), net: a.net + Number(r.net_amount) }),
    { gross: 0, fee: 0, net: 0 }
  );
  const feePct = Number((feeRow?.value as { percent?: number } | null)?.percent ?? 10);
  const vfNumber = String((vfRow?.value as string | null) ?? '0112417443').replace(/"/g, '');

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
        <CardHeader><CardTitle>عمولة المنصة الحالية: {feePct}% — استقبال: <span dir="ltr" className="font-mono">{vfNumber}</span></CardTitle></CardHeader>
        <CardContent>
          <form action={setFee} className="flex gap-2">
            <Input name="percent" type="number" min={0} max={50} step={0.5} defaultValue={feePct} dir="ltr" className="w-32" />
            <Button size="sm" type="submit">حفظ (0–50%)</Button>
          </form>
        </CardContent>
      </Card>
      <h2 className="mb-3 font-bold">طلبات السحب — ضمان بخطوتين</h2>
      <p className="mb-3 text-xs text-muted-foreground">1) الشركة تحوّل لرقم المنصة فودافون كاش → الإدارة تعتمد التمويل. 2) الإدارة تحوّل للباحث وتسجل المرجع → مكتمل.</p>
      {!data?.length ? <p className="text-sm text-muted-foreground">No payout requests.</p> : data.map((p: {
        id: string; amount: number; status: string; researcher_id: string;
        payment_methods: { label: string; type: string } | null;
      }) => (
        <Card key={p.id} className="mb-2">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span className="text-sm">
              <b className="tabular-nums" dir="ltr">{p.amount} EGP</b> — <StatusPill value={p.status} />
              <span className="ml-2 text-muted-foreground">{p.payment_methods?.label} ({p.payment_methods?.type})</span>
              <span className="block text-xs text-muted-foreground">{STEPS[p.status] ?? p.status}</span>
            </span>
            {p.status === 'pending' && (
              <span className="flex gap-2">
                <form action={approvePayoutAction.bind(null, p.id, true)}><Button size="sm" type="submit">تأكيد تمويل الشركة ✓</Button></form>
                <form action={approvePayoutAction.bind(null, p.id, false)}><Button size="sm" variant="outline" type="submit">رفض</Button></form>
              </span>
            )}
            {p.status === 'approved' && (
              <form action={completePayoutAction.bind(null, p.id)} className="flex gap-2">
                <Input name="reference" required maxLength={120} placeholder="مرجع تحويل فودافون كاش" dir="ltr" className="h-9 w-48" />
                <Button size="sm" type="submit">تم الدفع للباحث ✓</Button>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

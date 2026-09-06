import { Wallet as WalletIcon, Clock, PiggyBank } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { requestPayoutAction } from '@/features/wallet/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { SectionHeader } from '@/components/shared/section-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusPill } from '@/components/shared/status-pill';

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="py-2 text-sm">سجّل الدخول أولًا.</div>;
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) return <div className="py-2 text-sm text-muted-foreground">لا يوجد ملف باحث.</div>;
  const [{ data: wallet }, { data: txns }, { data: payouts }, { data: methods }] = await Promise.all([
    supabase.from('wallets').select('*').eq('researcher_id', rp.id).single(),
    supabase.from('wallet_transactions').select('id,type,amount,balance_after,note,created_at').order('created_at', { ascending: false }).limit(30),
    supabase.from('payout_requests').select('*').eq('researcher_id', rp.id).order('created_at', { ascending: false }),
    supabase.from('payment_methods').select('*').eq('researcher_id', rp.id),
  ]);

  return (
    <div className="py-2">
      <SectionHeader title="المحفظة" desc="الأرصدة والمعاملات وطلبات السحب" />
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{ok}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="الرصيد المتاح" value={`${Number(wallet?.balance ?? 0).toLocaleString()} EGP`} icon={WalletIcon} accent />
        <StatCard label="الرصيد المعلق" value={`${Number(wallet?.pending_balance ?? 0).toLocaleString()} EGP`} icon={Clock} />
        <StatCard label="إجمالي المكتسب" value={`${Number(wallet?.total_earned ?? 0).toLocaleString()} EGP`} icon={PiggyBank} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>طلب سحب جديد</CardTitle></CardHeader>
          <CardContent>
            {!methods?.length ? (
              <p className="text-sm text-muted-foreground">أضف وسيلة دفع من الإعدادات أولًا.</p>
            ) : (
              <form action={requestPayoutAction} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground" htmlFor="amount">المبلغ (EGP)</label>
                  <Input id="amount" name="amount" type="number" min={1} max={Number(wallet?.balance ?? 0)} required placeholder="500" dir="ltr" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground" htmlFor="pm">وسيلة الدفع</label>
                  <select id="pm" name="payment_method_id" className="mt-1 h-10 w-full rounded-md border px-3 text-sm" required>
                    {methods.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.type})</option>)}
                  </select>
                </div>
                <Button type="submit" className="w-full bg-slate-900 font-bold text-white hover:bg-slate-700">إرسال للمراجعة</Button>
              </form>
            )}
            {!!payouts?.length && (
              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-xs font-bold text-muted-foreground">طلباتك</p>
                {payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="tabular-nums">{Number(p.amount).toLocaleString()} EGP</span>
                    <StatusPill value={p.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader><CardTitle>سجل المعاملات</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!txns?.length ? (
              <div className="p-4"><EmptyState title="لا معاملات بعد" hint="المكافآت المعتمدة والسحوبات ستظهر هنا." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">النوع</th>
                      <th className="px-4 py-2.5 font-medium">المبلغ</th>
                      <th className="px-4 py-2.5 font-medium">البيان</th>
                      <th className="px-4 py-2.5 font-medium">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t: { id: string; type: string; amount: number; note: string | null; created_at: string }) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${t.type === 'bounty' ? 'bg-green-50 text-green-700' : t.type === 'payout' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                            {t.type === 'bounty' ? 'مكافأة' : t.type === 'payout' ? 'سحب' : t.type === 'refund' ? 'استرداد' : 'تسوية'}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 font-bold tabular-nums ${Number(t.amount) < 0 ? 'text-red-600' : 'text-green-700'}`} dir="ltr">
                          {Number(t.amount) > 0 ? '+' : ''}{Number(t.amount).toLocaleString()}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-2.5 text-muted-foreground">{t.note ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

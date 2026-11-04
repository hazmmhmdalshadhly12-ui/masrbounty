import { Wallet as WalletIcon, Clock, PiggyBank, ShieldCheck, Landmark } from 'lucide-react';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { requestPayoutAction } from '@/features/wallet/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { SectionHeader } from '@/components/shared/section-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusPill } from '@/components/shared/status-pill';
import { money, moneyShort, txnLabel } from '@/utils/finance';

const dt = (s: string) => new Date(s).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="py-2 text-sm">سجّل الدخول أولًا.</div>;
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) return <div className="py-2 text-sm text-muted-foreground">لا يوجد ملف باحث.</div>;
  const { data: wallet } = await supabase.from('wallets').select('*').eq('researcher_id', rp.id).maybeSingle();
  // Transactions are scoped to THIS wallet explicitly (defense-in-depth on top of RLS).
  const [{ data: txns }, { data: payouts }, { data: methods }] = await Promise.all([
    wallet
      ? supabase.from('wallet_transactions').select('id,type,amount,balance_after,note,created_at').eq('wallet_id', wallet.id).order('created_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] } as { data: { id: string; type: string; amount: number; balance_after: number; note: string | null; created_at: string }[] | null }),
    supabase.from('payout_requests').select('id,amount,status,review_note,created_at,updated_at').eq('researcher_id', rp.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('payment_methods').select('*').eq('researcher_id', rp.id),
  ]);

  return (
    <div className="py-2">
      <SectionHeader title="المحفظة" desc="الأرصدة والتحويلات وطلبات السحب" />
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {ok && <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700" role="status">{ok}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="الرصيد المتاح" value={`${moneyShort(wallet?.balance ?? 0)} EGP`} icon={WalletIcon} accent />
        <StatCard label="قيد الضمان (بانتظار الصرف)" value={`${moneyShort(wallet?.pending_balance ?? 0)} EGP`} icon={Clock} />
        <StatCard label="إجمالي المكتسب" value={`${moneyShort(wallet?.total_earned ?? 0)} EGP`} icon={PiggyBank} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">طلب سحب جديد</CardTitle>
            <CardDescription>يُراجع الطلب من الإدارة ثم يُحوَّل لوسيلة الدفع — عادة خلال ٣ أيام عمل.</CardDescription>
          </CardHeader>
          <CardContent>
            {!methods?.length ? (
              <p className="text-sm text-muted-foreground">
                أضف وسيلة دفع من <Link href="/dashboard/settings" className="font-medium underline underline-offset-4">الإعدادات</Link> أولًا.
              </p>
            ) : (
              <form action={requestPayoutAction} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground" htmlFor="amount">المبلغ (EGP)</label>
                  <Input id="amount" name="amount" type="number" min={1} max={Number(wallet?.balance ?? 0)} required placeholder="500" dir="ltr" inputMode="numeric" className="mt-1 tabular-nums" aria-describedby="amount-help" />
                  <p id="amount-help" className="mt-1 text-[11px] text-muted-foreground">الحد الأقصى المتاح: {money(wallet?.balance ?? 0)} EGP.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground" htmlFor="pm">وسيلة الدفع</label>
                  <select id="pm" name="payment_method_id" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" required>
                    {methods.map((m: { id: string; label: string; type: string }) => <option key={m.id} value={m.id}>{m.label} ({m.type})</option>)}
                  </select>
                </div>
                <Button type="submit" className="w-full cursor-pointer font-bold">إرسال للمراجعة</Button>
              </form>
            )}
            {!!payouts?.length && (
              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-xs font-bold text-muted-foreground">آخر طلباتك</p>
                {payouts.map((p: { id: string; amount: number; status: string; review_note: string | null; created_at: string }) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="tabular-nums" dir="ltr">{money(p.amount)} EGP</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">{dt(p.created_at)}</span>
                      <StatusPill value={p.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground" role="note">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>المبالغ «قيد الضمان» تنتظر صرف الشركة ثم تصبح متاحة للسحب تلقائيًا.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><Landmark className="h-4 w-4 text-primary" /> سجل التحويلات</CardTitle>
            <CardDescription>كل مكافأة وسحب وتسوية — مع الرصيد بعد كل حركة.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!txns?.length ? (
              <div className="p-4"><EmptyState title="لا تحويلات بعد" hint="المكافآت المعتمدة والسحوبات ستظهر هنا." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-sm">
                  <caption className="sr-only">سجل تحويلات المحفظة</caption>
                  <thead>
                    <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-medium">النوع</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">المبلغ</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">الرصيد بعدها</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">البيان</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t: { id: string; type: string; amount: number; balance_after: number; note: string | null; created_at: string }) => (
                      <tr key={t.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${t.type === 'bounty' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : t.type === 'payout' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {txnLabel(t.type)}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 font-bold tabular-nums ${Number(t.amount) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`} dir="ltr">
                          {Number(t.amount) > 0 ? '+' : ''}{money(t.amount)}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground" dir="ltr">{money(t.balance_after)}</td>
                        <td className="max-w-[220px] truncate px-4 py-2.5 text-muted-foreground">{t.note ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{dt(t.created_at)}</td>
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

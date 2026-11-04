import Link from 'next/link';
import {
  Wallet as WalletIcon, PlusCircle, Landmark, ShieldCheck, ArrowDownLeft,
  ArrowUpRight, Clock, ReceiptText, Info,
} from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { requestDepositAction } from '@/features/finance/services';
import { markPaidAction } from '@/features/company/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusPill } from '@/components/shared/status-pill';
import { money, moneyShort, methodLabel, txnLabel } from '@/utils/finance';
import type { CompanyWallet, CompanyWalletTransaction, DepositRequest } from '@/types/wallet';

export const dynamic = 'force-dynamic';

type AwardRow = {
  id: string;
  amount: number | string;
  status: string;
  created_at: string;
  reports: { report_number: string; title: string } | null;
};

const dt = (s: string) => new Date(s).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

export default async function CompanyPayments({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return <div className="container py-12">سجّل الدخول أولًا.</div>;

  const { data: mem } = await supabase
    .from('company_members')
    .select('company_id,role')
    .eq('user_id', auth.user.id)
    .limit(1)
    .maybeSingle();
  if (!mem) {
    return (
      <div className="container py-8">
        <PageHeader icon={WalletIcon} title="المحفظة والمدفوعات" desc="إدارة رصيد الشركة وتمويل المكافآت." />
        <EmptyState
          title="لا توجد شركة مرتبطة بحسابك"
          hint="أنشئ ملف الشركة أولًا لتصلك محفظة لتمويل مكافآت الباحثين."
          action={<Link href="/register" className="text-sm font-medium underline underline-offset-4">إنشاء حساب شركة</Link>}
        />
      </div>
    );
  }
  const companyId = (mem as { company_id: string }).company_id;
  const { data: walletRow } = await supabase.from('company_wallets').select('*').eq('company_id', companyId).maybeSingle();
  const walletId = (walletRow as { id: string } | null)?.id ?? null;

  const [{ data: deposits }, { data: awards }, { data: txns }, { data: vfRow }] = await Promise.all([
    supabase.from('deposit_requests').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20),
    supabase
      .from('bounty_awards')
      .select('id,amount,status,created_at,reports!inner(report_number,title,programs!inner(company_id))')
      .eq('reports.programs.company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50),
    // Ledger is scoped to THIS wallet explicitly (defense-in-depth on top of RLS).
    walletId
      ? supabase.from('company_wallet_transactions').select('*').eq('company_wallet_id', walletId).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [] } as { data: CompanyWalletTransaction[] | null }),
    supabase.from('platform_settings').select('value').eq('key', 'vf_cash_number').maybeSingle(),
  ]);

  const wallet = (walletRow ?? null) as CompanyWallet | null;
  const depositRows = (deposits ?? []) as unknown as DepositRequest[];
  const awardRows = (awards ?? []) as unknown as AwardRow[];
  const txnRows = (txns ?? []) as unknown as CompanyWalletTransaction[];
  const vfNumber = String((vfRow?.value as string | null) ?? '').replace(/"/g, '').trim();
  const dueTotal = awardRows.filter((a) => a.status === 'approved').reduce((s, a) => s + Number(a.amount), 0);

  return (
    <div className="container space-y-6 py-8" dir="rtl">
      <PageHeader
        icon={WalletIcon}
        title="المحفظة والمدفوعات"
        desc="اشحن رصيد الشركة، موّل المكافآت، وتابع كل حركة مالية."
      />
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">{error}</p>}
      {ok && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300" role="status">{ok}</p>}

      {/* Balance overview */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="الرصيد المتاح" value={`${moneyShort(wallet?.balance ?? 0)} EGP`} icon={WalletIcon} accent />
        <StatCard label="إجمالي ما تم تمويله" value={`${moneyShort(wallet?.total_funded ?? 0)} EGP`} icon={ArrowDownLeft} />
        <StatCard label="إجمالي ما تم صرفه" value={`${moneyShort(wallet?.total_spent ?? 0)} EGP`} icon={ArrowUpRight} />
        <StatCard label="مكافآت بانتظار الصرف" value={`${moneyShort(dueTotal)} EGP`} icon={Clock} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Deposit request */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><PlusCircle className="h-4 w-4 text-primary" /> شحن رصيد المحفظة</CardTitle>
            <CardDescription>حوّل المبلغ أولًا ثم سجّل طلب الإيداع — تُضاف النقود بعد تحقق الإدارة.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground" role="note">
              <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                حوّل المبلغ عبر{' '}
                {vfNumber
                  ? <>فودافون كاش إلى <b className="font-mono" dir="ltr">{vfNumber}</b></>
                  : <>وسيلة التحويل المعتمدة (راجع الإدارة)</>}
                ، ثم أدخل مرجع التحويل كما يظهر في إشعار العملية.
              </span>
            </div>
            <form action={requestDepositAction} className="space-y-3">
              <div>
                <label htmlFor="dep-amount" className="text-xs font-bold text-muted-foreground">المبلغ (EGP)</label>
                <Input id="dep-amount" name="amount" type="number" min={50} max={1000000} step={50} required placeholder="5000" dir="ltr" inputMode="numeric" className="mt-1 tabular-nums" aria-describedby="dep-amount-help" />
                <p id="dep-amount-help" className="mt-1 text-[11px] text-muted-foreground">الحد الأدنى ٥٠ جنيهًا.</p>
              </div>
              <div>
                <label htmlFor="dep-method" className="text-xs font-bold text-muted-foreground">وسيلة التحويل</label>
                <select id="dep-method" name="method" required className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="vodafone_cash">فودافون كاش</option>
                  <option value="instapay">إنستاباي</option>
                  <option value="bank">تحويل بنكي</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label htmlFor="dep-ref" className="text-xs font-bold text-muted-foreground">مرجع التحويل *</label>
                <Input id="dep-ref" name="reference" required minLength={4} maxLength={120} placeholder="مثال: VF-123456789" dir="ltr" className="mt-1" />
              </div>
              <div>
                <label htmlFor="dep-sender" className="text-xs font-bold text-muted-foreground">اسم المُحوِّل (اختياري)</label>
                <Input id="dep-sender" name="sender_name" maxLength={120} placeholder="اسم صاحب الحساب" className="mt-1" />
              </div>
              <Button type="submit" className="w-full font-bold cursor-pointer">إرسال طلب الإيداع</Button>
            </form>
          </CardContent>
        </Card>

        {/* Ledger + escrow explainer */}
        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><ReceiptText className="h-4 w-4 text-primary" /> سجل تحويلات محفظة الشركة</CardTitle>
              <CardDescription>كل إيداع وتمويل مكافأة وتسوية — بالرصيد بعد كل حركة.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!txnRows.length ? (
                <div className="p-4"><EmptyState title="لا حركات بعد" hint="أول إيداع معتمد سيظهر هنا مع كل حركة لاحقة." /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-sm">
                    <caption className="sr-only">سجل تحويلات محفظة الشركة</caption>
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
                      {txnRows.map((t) => (
                        <tr key={t.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${t.type === 'deposit' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : t.type === 'bounty' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-primary" /> كيف يعمل الضمان؟</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
                <li>تشحن محفظتك بعد تحقق الإدارة من التحويل.</li>
                <li>عند منح مكافأة يُخصم مبلغها من رصيدك فورًا ويُحفظ للباحث في الضمان.</li>
                <li>عند صرف المكافأة ينتقل المبلغ المحفوظ إلى رصيد الباحث المتاح للسحب.</li>
              </ol>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                تأكد من وجود رصيد كافٍ قبل منح مكافأة — تُرفض المنح عندما يكون الرصيد غير كافٍ.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deposit requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">طلبات الإيداع</CardTitle>
          <CardDescription>حالة كل طلب شحن رصيد أرسلته للإدارة.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!depositRows.length ? (
            <div className="p-4"><EmptyState title="لا طلبات إيداع" hint="أرسل أول طلب من نموذج شحن الرصيد بالأعلى." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">طلبات الإيداع</caption>
                <thead>
                  <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">المبلغ</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">الوسيلة</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">المرجع</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">الحالة</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {depositRows.map((d) => (
                    <tr key={d.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5 font-bold tabular-nums" dir="ltr">{money(d.amount)}</td>
                      <td className="px-4 py-2.5">{methodLabel(d.method)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs" dir="ltr">{d.reference}</td>
                      <td className="px-4 py-2.5"><StatusPill value={d.status} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{dt(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bounty awards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">المكافآت الممنوحة</CardTitle>
          <CardDescription>كل مكافأة ممنوحة على تقارير برامجك — تُخصم من المحفظة عند المنح، وصرفها للباحث يُطلقها من الضمان إلى رصيده المتاح.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!awardRows.length ? (
            <div className="p-4"><EmptyState title="لا مكافآت بعد" hint="عند منح أول مكافأة لتقرير مقبول ستظهر هنا." /></div>
          ) : (
            <div className="divide-y">
              {awardRows.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 transition-colors hover:bg-muted/40">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{a.reports?.title ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono" dir="ltr">{a.reports?.report_number ?? ''}</span>
                      {' '}· <b className="tabular-nums" dir="ltr">{money(a.amount)} EGP</b>
                      {' '}· <StatusPill value={a.status} />
                      {' '}· {dt(a.created_at)}
                    </p>
                  </div>
                  {a.status === 'approved' && (
                    <form action={markPaidAction.bind(null, a.id)} className="flex gap-2">
                      <Input name="reference" maxLength={120} placeholder="مرجع الإطلاق (اختياري)" dir="ltr" className="h-9 w-40" aria-label="مرجع الإطلاق (اختياري)" />
                      <Button size="sm" type="submit" className="cursor-pointer font-bold">صرف للباحث ✓</Button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import Link from 'next/link';
import {
  Wallet as WalletIcon, PlusCircle, Landmark, ShieldCheck, ArrowDownLeft,
  ArrowUpRight, Clock, ReceiptText, Info, History,
} from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { submitDepositRequestAction } from '@/features/finance/company-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusPill } from '@/components/shared/status-pill';
import { money, methodLabel, txnLabel } from '@/utils/finance';
import { formatMinor, bpToPercent } from '@/lib/finance/money';
import type {
  CompanyWalletV2, WalletDepositRequest, WalletTransactionV2,
  ResearcherPayout, DepositRequest, CompanyWalletTransaction,
  BountyReward, CommissionSetting,
} from '@/types/wallet';

export const dynamic = 'force-dynamic';

const dt = (s: string) => new Date(s).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

const PAYOUT_STATE_AR: Record<string, string> = {
  awaiting_payout: 'بانتظار الصرف',
  processing: 'قيد التنفيذ',
  paid: 'مدفوعة',
  failed: 'فشل الصرف — أُرجع الحجز',
  cancelled: 'ملغاة — أُرجع الحجز',
};

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
        <PageHeader icon={WalletIcon} title="المحفظة الذكية" desc="إدارة رصيد الشركة وتمويل المكافآت." />
        <EmptyState
          title="لا توجد شركة مرتبطة بحسابك"
          hint="أنشئ ملف الشركة أولًا لتصلك محفظة لتمويل مكافآت الباحثين."
          action={<Link href="/register" className="text-sm font-medium underline underline-offset-4">إنشاء حساب شركة</Link>}
        />
      </div>
    );
  }
  const companyId = (mem as { company_id: string }).company_id;
  const walletId = (await supabase.from('company_wallets').select('id').eq('company_id', companyId).maybeSingle()).data as { id: string } | null;

  const [{ data: walletRow }, { data: rateRow }, { data: wdeposits }, { data: wtxns }, { data: payouts }, { data: rewards }, { data: vfRow }, { data: legacyDeposits }, { data: legacyTxns }] = await Promise.all([
    supabase.from('company_wallets').select('*').eq('company_id', companyId).maybeSingle(),
    supabase.from('commission_settings').select('*').eq('scope', 'global').eq('is_active', true).limit(1).maybeSingle(),
    // Scoped explicitly to THIS company (defense-in-depth on top of RLS).
    supabase.from('wallet_deposit_requests').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20),
    walletId
      ? supabase.from('wallet_transactions_v2').select('*').eq('wallet_id', (walletId as { id: string }).id).order('created_at', { ascending: false }).limit(40)
      : Promise.resolve({ data: [] } as { data: WalletTransactionV2[] | null }),
    supabase.from('researcher_payouts').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20),
    supabase.from('bounty_rewards').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20),
    supabase.from('platform_settings').select('value').eq('key', 'vf_cash_number').maybeSingle(),
    // Legacy records stay visible (read-only) — history is never hidden.
    supabase.from('deposit_requests').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
    walletId
      ? supabase.from('company_wallet_transactions').select('*').eq('company_wallet_id', (walletId as { id: string }).id).order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] } as { data: CompanyWalletTransaction[] | null }),
  ]);

  const wallet = (walletRow ?? null) as CompanyWalletV2 | null;
  const rate = (rateRow ?? null) as CommissionSetting | null;
  const depositRows = (wdeposits ?? []) as unknown as WalletDepositRequest[];
  const txnRows = (wtxns ?? []) as unknown as WalletTransactionV2[];
  const payoutRows = (payouts ?? []) as unknown as ResearcherPayout[];
  const rewardRows = (rewards ?? []) as unknown as BountyReward[];
  const legacyDepositRows = (legacyDeposits ?? []) as unknown as DepositRequest[];
  const legacyTxnRows = (legacyTxns ?? []) as unknown as CompanyWalletTransaction[];
  const vfNumber = String((vfRow?.value as string | null) ?? '').replace(/"/g, '').trim();
  const pendingPayouts = payoutRows.filter((p) => p.status === 'awaiting_payout' || p.status === 'processing');

  return (
    <div className="container space-y-6 py-8" dir="rtl">
      <PageHeader
        icon={WalletIcon}
        title="المحفظة الذكية"
        desc="رصيد متاح ومحجوز، إيداعات معتمدة، ومكافآت بصنفة محاسبي غير قابل للتعديل."
      />
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">{error}</p>}
      {ok && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300" role="status">{ok}</p>}

      {/* Balance overview (integer minor units under the hood) */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="الرصيد المتاح" value={`${formatMinor(wallet?.available_balance_minor ?? 0)} EGP`} icon={WalletIcon} accent />
        <StatCard label="المحجوز للمكافآت" value={`${formatMinor(wallet?.reserved_balance_minor ?? 0)} EGP`} icon={Clock} />
        <StatCard label="إجمالي الإيداعات المعتمدة" value={`${formatMinor(wallet?.total_deposits_minor ?? 0)} EGP`} icon={ArrowDownLeft} />
        <StatCard label="إجمالي المكافآت المصروفة" value={`${formatMinor(wallet?.total_rewards_minor ?? 0)} EGP`} icon={ArrowUpRight} />
        <StatCard label="إجمالي عمولة المنصة" value={`${formatMinor(wallet?.total_fees_minor ?? 0)} EGP`} icon={ReceiptText} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Deposit request */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><PlusCircle className="h-4 w-4 text-primary" /> شحن رصيد المحفظة</CardTitle>
            <CardDescription>حوّل المبلغ أولًا ثم سجّل طلب إيداع — لا يُضاف الرصيد إلا بعد اعتماد الإدارة للتحويل.</CardDescription>
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
            <form action={submitDepositRequestAction} className="space-y-3">
              <div>
                <label htmlFor="dep2-amount" className="text-xs font-bold text-muted-foreground">المبلغ (EGP — حتى منزلتين)</label>
                <Input id="dep2-amount" name="amount" required placeholder="5000 أو 5000.50" dir="ltr" inputMode="decimal" className="mt-1 tabular-nums" />
              </div>
              <div>
                <label htmlFor="dep2-method" className="text-xs font-bold text-muted-foreground">وسيلة التحويل</label>
                <select id="dep2-method" name="method" required defaultValue="" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="" disabled>— اختر —</option>
                  <option value="vodafone_cash">فودافون كاش</option>
                  <option value="instapay">إنستاباي</option>
                  <option value="bank">تحويل بنكي</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label htmlFor="dep2-reference" className="text-xs font-bold text-muted-foreground">مرجع التحويل</label>
                <Input id="dep2-reference" name="reference" required minLength={4} maxLength={120} placeholder="مثال: VC-8899771" dir="ltr" className="mt-1 font-mono" />
              </div>
              <div>
                <label htmlFor="dep2-sender" className="text-xs font-bold text-muted-foreground">اسم المُحوِّل (اختياري)</label>
                <Input id="dep2-sender" name="sender_name" maxLength={120} className="mt-1" />
              </div>
              <div>
                <label htmlFor="dep2-proof" className="text-xs font-bold text-muted-foreground">رابط صورة الإثبات (اختياري)</label>
                <Input id="dep2-proof" name="proof_url" type="url" dir="ltr" placeholder="https://…" className="mt-1" />
                <p className="mt-1 text-[11px] text-muted-foreground">إرفاق الإثبات لا يضيف رصيدًا — الاعتماد يدوي من الإدارة.</p>
              </div>
              <div>
                <label htmlFor="dep2-note" className="text-xs font-bold text-muted-foreground">ملاحظة (اختياري)</label>
                <Input id="dep2-note" name="note" maxLength={500} className="mt-1" />
              </div>
              <Button type="submit" className="w-full cursor-pointer font-bold">إرسال طلب الإيداع</Button>
            </form>
          </CardContent>
        </Card>

        {/* How the money moves + payout queue */}
        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-primary" /> كيف تتحرك الأموال</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ol className="list-inside list-decimal space-y-1.5 text-muted-foreground">
                <li>تشحن محفظتك بعد تحقق الإدارة من التحويل (اعتماد يدوي — مرة واحدة).</li>
                <li>اعتماد مكافأة يحجز (المكافأة + العمولة) من الرصيد المتاح فورًا.</li>
                <li>
                  صرف المكافأة يفرّج عن الحجز: قيمة المكافأة للباحث، والعمولة دخلًا للمنصة
                  {rate ? <> (النسبة الحالية <b>{bpToPercent(rate.rate_bp)}%</b>)</> : null}.
                </li>
                <li>فشل الصرف أو إلغاؤه يعيد المبلغ المحجوز كاملًا إلى رصيدك المتاح.</li>
              </ol>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                كل حركة تُسجَّل بمعرّف تفرد يمنع التكرار، في دفتر يوميات غير قابل للتعديل أو الحذف.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">صرفيات مكافآت الباحثين</CardTitle>
              <CardDescription>
                بانتظار الصرف: {pendingPayouts.length} — الصرف النهائي ينفّذه فريق المنصة بعد التحويل وإرفاق الإثبات.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!payoutRows.length ? (
                <div className="p-4"><EmptyState title="لا صرفيات بعد" hint="عند اعتماد أول مكافأة ستظهر هنا بحالتها." /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <caption className="sr-only">صرفيات مكافآت الباحثين</caption>
                    <thead>
                      <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                        <th scope="col" className="px-4 py-2.5 font-medium">المبلغ</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">الحالة</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">ملاحظة</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutRows.map((p) => (
                        <tr key={p.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                          <td className="px-4 py-2.5 font-bold tabular-nums" dir="ltr">{formatMinor(p.amount_minor)} EGP</td>
                          <td className="px-4 py-2.5">{PAYOUT_STATE_AR[p.status] ?? p.status}</td>
                          <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-muted-foreground">{p.failure_reason ?? p.payment_reference ?? '—'}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{dt(p.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {rewardRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">المكافآت المعتمدة (نسب مقفولة)</CardTitle>
                <CardDescription>نسبة العمولة تُثبَّت داخل كل مكافأة لحظة اعتمادها.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {rewardRows.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-muted/40">
                      <span className="font-mono text-xs" dir="ltr">{r.report_id.slice(0, 8)}…</span>
                      <span className="tabular-nums" dir="ltr">{formatMinor(r.reward_amount_minor)} EGP</span>
                      <span className="text-xs text-muted-foreground">عمولة {bpToPercent(r.commission_rate_bp)}% ({formatMinor(r.commission_amount_minor)})</span>
                      <StatusPill value={r.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Deposit requests (v2) */}
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
              <table className="w-full min-w-[560px] text-sm">
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
                      <td className="px-4 py-2.5 font-bold tabular-nums" dir="ltr">{formatMinor(d.amount_minor)} EGP</td>
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

      {/* Wallet transactions (immutable ledger feed) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">حركات المحفظة</CardTitle>
          <CardDescription>سجل غير قابل للتعديل — كل عملية بمعرّف تفرد.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!txnRows.length ? (
            <div className="p-4"><EmptyState title="لا حركات بعد" hint="ستظهر عمليات الإيداع والحجز والصرف هنا." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">حركات المحفظة</caption>
                <thead>
                  <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">النوع</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">المبلغ</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">المتاح بعدها</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">المحجوز بعدها</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {txnRows.map((t) => (
                    <tr key={t.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5">{txnLabel(t.type)}</td>
                      <td className={`px-4 py-2.5 font-bold tabular-nums ${t.direction === 'in' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`} dir="ltr">
                        {t.direction === 'in' ? '+' : '−'}{formatMinor(t.amount_minor)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums" dir="ltr">{formatMinor(t.available_after_minor)}</td>
                      <td className="px-4 py-2.5 tabular-nums" dir="ltr">{formatMinor(t.reserved_after_minor)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{dt(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legacy history — kept visible, read-only */}
      {(legacyDepositRows.length > 0 || legacyTxnRows.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4" /> السجل القديم (للقراءة فقط)</CardTitle>
            <CardDescription>عمليات ما قبل نظام الدفتر المحاسبي — محفوظة كمرجع تاريخي.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 text-sm">
            {legacyDepositRows.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-bold text-muted-foreground">إيداعات قديمة</p>
                <ul className="space-y-1">
                  {legacyDepositRows.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="tabular-nums" dir="ltr">{money(d.amount)} EGP</span>
                      <StatusPill value={d.status} />
                      <span className="text-muted-foreground">{dt(d.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {legacyTxnRows.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-bold text-muted-foreground">حركات قديمة</p>
                <ul className="space-y-1">
                  {legacyTxnRows.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 text-xs">
                      <span>{txnLabel(t.type)}</span>
                      <span className="tabular-nums" dir="ltr">{money(t.amount)} EGP</span>
                      <span className="text-muted-foreground">{dt(t.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

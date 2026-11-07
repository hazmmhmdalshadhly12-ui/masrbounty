'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Banknote, Coins, Download, Landmark, Loader2, Percent, PiggyBank, ShieldCheck, TrendingUp, Wallet, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/shared/stat-card';
import { ExportButton } from '@/components/shared/export-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { bpToPercent, formatMinor } from '@/lib/finance/money';
import { methodLabel } from '@/utils/finance';
import {
  reviewDepositRequestV2Action,
  startRewardPayoutAction,
  completeRewardPayoutAction,
  failRewardPayoutAction,
  setCommissionRateAction,
  toggleCompanyCommissionAction,
  adjustCompanyWalletV2Action,
} from '@/features/finance/admin-actions';

interface Metrics {
  depositsTotalMinor: number;
  availableMinor: number;
  reservedMinor: number;
  feesMinor: number;
  rewardsPaidMinor: number;
  payoutsAwaiting: number;
  payoutsAwaitingMinor: number;
  payoutsProcessing: number;
  payoutsFailed: number;
  depositsPending: number;
  ledgerRevenueMinor: number;
  rewardsActive: number;
}

interface WalletRow {
  company_id: string;
  company_name: string;
  available_minor: number;
  reserved_minor: number;
  deposits_minor: number;
  rewards_minor: number;
  fees_minor: number;
}
interface PayoutRow {
  id: string;
  reward_id: string;
  researcher: string;
  company: string;
  amount_minor: number;
  status: string;
  failure_reason: string | null;
  payment_reference: string | null;
  created_at: string;
}
interface DepositRow {
  id: string;
  company: string;
  amount_minor: number;
  method: string;
  reference: string;
  proof_url: string | null;
  status: string;
  created_at: string;
}
interface TxnRow {
  id: string;
  company: string;
  type: string;
  direction: string;
  amount_minor: number;
  available_after_minor: number;
  reserved_after_minor: number;
  created_at: string;
}
interface CommissionInfo {
  global: { rate_bp: number } | null;
  overrides: Array<{ company_id: string; company_name: string; rate_bp: number; is_active: boolean }>;
}
interface HistoryRow {
  id: string;
  scope: string;
  company_id: string | null;
  old_rate_bp: number | null;
  new_rate_bp: number;
  is_active: boolean;
  reason: string;
  changed_at: string;
}

const dt = (s: string) => new Date(s).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const PAYOUT_STATE_AR: Record<string, string> = {
  awaiting_payout: 'بانتظار الصرف',
  processing: 'قيد التنفيذ',
  paid: 'مدفوعة',
  failed: 'فاشلة',
  cancelled: 'ملغاة',
};

/** Alert box for server-action errors. */
function Msg({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <p role="alert" className="rounded-md bg-red-50 p-2.5 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>;
  if (ok) return <p role="status" className="rounded-md bg-green-50 p-2.5 text-sm font-medium text-green-700 dark:bg-green-950 dark:text-green-300">{ok}</p>;
  return null;
}

function ActionButton({ busy, children, ...rest }: React.ComponentProps<typeof Button> & { busy?: boolean }) {
  return (
    <Button size="sm" type="button" disabled={busy} {...rest}>
      {busy && <Loader2 className="ml-1.5 h-3.5 w-3.5 animate-spin" />}
      {children}
    </Button>
  );
}

export function FinanceDashboard({
  metrics, wallets, payouts, deposits, txns, commission, history,
}: {
  metrics: Metrics;
  wallets: WalletRow[];
  payouts: PayoutRow[];
  deposits: DepositRow[];
  txns: TxnRow[];
  commission: CommissionInfo;
  history: HistoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Filters (client-side over the fetched windows)
  const [fCompany, setFCompany] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const inRange = (iso: string) => {
    if (fFrom && new Date(iso) < new Date(fFrom)) return false;
    if (fTo && new Date(iso) > new Date(`${fTo}T23:59:59`)) return false;
    return true;
  };
  const matchCompany = (name: string) => !fCompany || name === fCompany;

  const fPayouts = useMemo(
    () => payouts.filter((p) => matchCompany(p.company) && (!fStatus || p.status === fStatus) && inRange(p.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payouts, fCompany, fStatus, fFrom, fTo]
  );
  const fDeposits = useMemo(
    () => deposits.filter((d) => matchCompany(d.company) && (!fStatus || d.status === fStatus) && inRange(d.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deposits, fCompany, fStatus, fFrom, fTo]
  );
  const fTxns = useMemo(
    () => txns.filter((t) => matchCompany(t.company) && inRange(t.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txns, fCompany, fFrom, fTo]
  );

  function run(fn: () => Promise<void>, success: string) {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setOkMsg(success);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل تنفيذ العملية');
      }
    });
  }

  const companyNames = useMemo(() => Array.from(new Set([...payouts.map((p) => p.company), ...deposits.map((d) => d.company), ...txns.map((t) => t.company)])).sort(), [payouts, deposits, txns]);

  const csvRows = useMemo(
    () =>
      fTxns.map((t) => ({
        date: t.created_at,
        company: t.company,
        type: t.type,
        direction: t.direction,
        amount_minor: t.amount_minor,
        available_after_minor: t.available_after_minor,
        reserved_after_minor: t.reserved_after_minor,
      })),
    [fTxns]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">لوحة المالية الذكية</h1>
          <p className="text-sm text-muted-foreground">دفتر محاسبي غير قابل للتعديل بمبالغ صحيحة (قروش) — لا نقطة عائمة.</p>
        </div>
        <ExportButton rows={csvRows} filename={`masrbounty-finance-${new Date().toISOString().slice(0, 10)}.csv`} />
      </div>

      <Msg error={error} ok={okMsg} />

      {/* 10 KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="إيداعات معتمدة" value={`${formatMinor(metrics.depositsTotalMinor)} EGP`} icon={Landmark} accent />
        <StatCard label="أرصدة متاحة (الكل)" value={`${formatMinor(metrics.availableMinor)} EGP`} icon={Wallet} />
        <StatCard label="محجوز للمكافآت" value={`${formatMinor(metrics.reservedMinor)} EGP`} icon={PiggyBank} />
        <StatCard label="عمولات محققة" value={`${formatMinor(metrics.feesMinor)} EGP`} icon={Percent} />
        <StatCard label="مكافآت مصروفة" value={`${formatMinor(metrics.rewardsPaidMinor)} EGP`} icon={BadgeCheck} />
        <StatCard label="إيراد الدفتر (platform_revenue)" value={`${formatMinor(metrics.ledgerRevenueMinor)} EGP`} icon={TrendingUp} />
        <StatCard label="بانتظار الصرف" value={String(metrics.payoutsAwaiting)} icon={Banknote} />
        <StatCard label="قيد التنفيذ" value={String(metrics.payoutsProcessing)} icon={Coins} />
        <StatCard label="فاشلة/ملغاة" value={String(metrics.payoutsFailed)} icon={XCircle} />
        <StatCard label="إيداعات معلقة" value={String(metrics.depositsPending)} icon={ShieldCheck} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label htmlFor="flt-company" className="block text-xs font-bold text-muted-foreground">الشركة</label>
            <select id="flt-company" value={fCompany} onChange={(e) => setFCompany(e.target.value)} className="mt-1 h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">الكل</option>
              {companyNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="flt-status" className="block text-xs font-bold text-muted-foreground">الحالة (صرف/إيداع)</label>
            <select id="flt-status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="mt-1 h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">الكل</option>
              {['awaiting_payout', 'processing', 'paid', 'failed', 'cancelled', 'pending', 'approved', 'rejected'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="flt-from" className="block text-xs font-bold text-muted-foreground">من</label>
            <Input id="flt-from" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="mt-1 h-9 w-40" />
          </div>
          <div>
            <label htmlFor="flt-to" className="block text-xs font-bold text-muted-foreground">إلى</label>
            <Input id="flt-to" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="mt-1 h-9 w-40" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="payouts">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="payouts">الصرفيات</TabsTrigger>
          <TabsTrigger value="deposits">طلبات الإيداع</TabsTrigger>
          <TabsTrigger value="commission">عمولة المنصة</TabsTrigger>
          <TabsTrigger value="ledger">الدفتر والمحافظ</TabsTrigger>
        </TabsList>

        {/* Payouts */}
        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">صرفيات مكافآت الباحثين</CardTitle>
              <CardDescription>
                لا يمكن أبدًا تسجيل «مدفوعة» من حالة فاشلة/ملغاة — والفشل يعيد الحجز تلقائيًا.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {!fPayouts.length && <p className="text-sm text-muted-foreground">لا نتائج بعد الفلترة.</p>}
              {fPayouts.map((p) => (
                <div key={p.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <b dir="ltr">{formatMinor(p.amount_minor)} EGP</b> — {p.researcher} <span className="text-muted-foreground">({p.company})</span>
                    </div>
                    <Badge variant={p.status === 'paid' ? 'default' : p.status === 'failed' || p.status === 'cancelled' ? 'destructive' : 'secondary'}>
                      {PAYOUT_STATE_AR[p.status] ?? p.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dt(p.created_at)}
                    {p.payment_reference ? <> · مرجع: <span dir="ltr" className="font-mono">{p.payment_reference}</span></> : null}
                    {p.failure_reason ? <> · السبب: {p.failure_reason}</> : null}
                  </p>
                  {(p.status === 'awaiting_payout' || p.status === 'processing') && (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      {p.status === 'awaiting_payout' && (
                        <ActionButton
                          busy={pending}
                          onClick={() => run(() => startRewardPayoutAction(p.id), 'نُقلت الصرفية إلى قيد التنفيذ')}
                          variant="outline"
                        >
                          بدء التنفيذ
                        </ActionButton>
                      )}
                      <form
                        action={(fd: FormData) => run(() => completeRewardPayoutAction(p.id, fd), 'تم تسجيل الدفع وتحرير الحجز')}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <div>
                          <label htmlFor={`proof-${p.id}`} className="block text-xs font-bold text-muted-foreground">رابط إثبات الدفع</label>
                          <Input id={`proof-${p.id}`} name="proof_url" type="url" required dir="ltr" placeholder="https://…" className="h-9 w-56" />
                        </div>
                        <div>
                          <label htmlFor={`ref-${p.id}`} className="block text-xs font-bold text-muted-foreground">المرجع (اختياري)</label>
                          <Input id={`ref-${p.id}`} name="reference" dir="ltr" maxLength={120} className="h-9 w-40" />
                        </div>
                        <ActionButton busy={pending} type="submit">تسجيل الدفع ✓</ActionButton>
                      </form>
                      <form
                        action={(fd: FormData) => run(() => failRewardPayoutAction(p.id, String(fd.get('reason') ?? ''), fd.get('cancel') === 'on'), 'سُجّل الفشل وعاد الحجز للرصيد المتاح')}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <div>
                          <label htmlFor={`fail-${p.id}`} className="block text-xs font-bold text-muted-foreground">سبب الفشل</label>
                          <Input id={`fail-${p.id}`} name="reason" required minLength={3} className="h-9 w-52" />
                        </div>
                        <label className="flex items-center gap-1.5 pb-1.5 text-xs font-medium">
                          <input type="checkbox" name="cancel" className="h-4 w-4" /> إلغاء بدلًا من فشل
                        </label>
                        <ActionButton busy={pending} type="submit" variant="destructive">فشل/إلغاء + إرجاع الحجز</ActionButton>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deposits */}
        <TabsContent value="deposits">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">طلبات الإيداع</CardTitle>
              <CardDescription>الاعتماد يُثبّت الرصيد مرة واحدة عبر مفتاح تفرد — إعادة الاعتماد مستحيلة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {!fDeposits.length && <p className="text-sm text-muted-foreground">لا نتائج بعد الفلترة.</p>}
              {fDeposits.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="text-sm">
                    <b dir="ltr">{formatMinor(d.amount_minor)} EGP</b> — {d.company}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {methodLabel(d.method)} · <span className="font-mono" dir="ltr">{d.reference}</span> · {dt(d.created_at)}
                      {d.proof_url && <> · <a href={d.proof_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">الإثبات</a></>}
                    </p>
                  </div>
                  {d.status === 'pending' ? (
                    <div className="flex gap-2">
                      <ActionButton busy={pending} onClick={() => run(() => reviewDepositRequestV2Action(d.id, true, ''), 'اعتُمد الإيداع وأُضيف للرصيد مرة واحدة')}>
                        اعتماد
                      </ActionButton>
                      <ActionButton busy={pending} variant="destructive" onClick={() => run(() => reviewDepositRequestV2Action(d.id, false, 'لم يتم التحقق من التحويل'), 'رُفض الطلب')}>
                        رفض
                      </ActionButton>
                    </div>
                  ) : (
                    <Badge variant={d.status === 'approved' ? 'default' : 'destructive'}>{d.status === 'approved' ? 'معتمد' : 'مرفوض'}</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commission */}
        <TabsContent value="commission">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ضبط نسبة العمولة</CardTitle>
                <CardDescription>
                  النسبة تُقرأ من قاعدة البيانات ولا تُكتب في الكود إطلاقًا. النسبة الخاصة بالشركة تتفوق على العامة، وتُثبَّت النسبة المعتمدة داخل كل مكافأة.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={setCommissionRateAction} className="space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label htmlFor="cs-scope" className="block text-xs font-bold text-muted-foreground">النطاق</label>
                      <select id="cs-scope" name="scope" defaultValue="global" className="mt-1 h-9 rounded-md border bg-background px-2 text-sm">
                        <option value="global">عامة (كل الشركات)</option>
                        <option value="company">خاصة بشركة</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cs-company" className="block text-xs font-bold text-muted-foreground">الشركة (للنطاق الخاص)</label>
                      <select id="cs-company" name="company_id" defaultValue="" className="mt-1 h-9 rounded-md border bg-background px-2 text-sm">
                        <option value="">—</option>
                        {wallets.map((w) => <option key={w.company_id} value={w.company_id}>{w.company_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cs-rate" className="block text-xs font-bold text-muted-foreground">النسبة % (0–100)</label>
                      <Input id="cs-rate" name="rate_percent" required dir="ltr" placeholder="20" className="h-9 w-24" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="cs-reason" className="block text-xs font-bold text-muted-foreground">سبب التعديل</label>
                    <Input id="cs-reason" name="reason" required minLength={3} className="mt-1 w-80" />
                  </div>
                  <ActionButton busy={pending} type="submit">حفظ النسبة</ActionButton>
                </form>

                <div className="rounded-lg border p-3 text-sm">
                  <p>
                    النسبة العامة الحالية:{' '}
                    <b>{commission.global ? `${bpToPercent(commission.global.rate_bp)}%` : 'غير مضبوطة'}</b>
                  </p>
                  {commission.overrides.map((o) => (
                    <div key={o.company_id} className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                      <span>
                        {o.company_name}: <b>{bpToPercent(o.rate_bp)}%</b>{' '}
                        <Badge variant={o.is_active ? 'default' : 'outline'}>{o.is_active ? 'مفعّلة' : 'موقوفة'}</Badge>
                      </span>
                      <ActionButton busy={pending} variant="outline" onClick={() => run(() => toggleCompanyCommissionAction(o.company_id, !o.is_active), o.is_active ? 'أُوقفت النسبة الخاصة' : 'فُعّلت النسبة الخاصة')}>
                        {o.is_active ? 'إيقاف' : 'تفعيل'}
                      </ActionButton>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">سجل تغيّرات النسبة</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {!history.length && <p className="text-sm text-muted-foreground">لا تغييرات بعد.</p>}
                <ul className="space-y-2 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
                      <Badge variant="outline">{h.scope === 'global' ? 'عامة' : 'خاصة'}</Badge>
                      <span className="tabular-nums" dir="ltr">
                        {h.old_rate_bp !== null ? `${bpToPercent(h.old_rate_bp)}% → ` : ''}
                        <b>{bpToPercent(h.new_rate_bp)}%</b>
                      </span>
                      {!h.is_active && <Badge variant="destructive">موقوفة</Badge>}
                      <span className="text-xs text-muted-foreground">{h.reason}</span>
                      <span className="ms-auto text-xs text-muted-foreground">{dt(h.changed_at)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Ledger */}
        <TabsContent value="ledger" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">حركات المحافظ (آخر 200)</CardTitle>
              <CardDescription>كل صف بمعرّف تفرد — التكرار مستحيل على مستوى قاعدة البيانات.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <caption className="sr-only">حركات المحافظ</caption>
                  <thead>
                    <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-medium">الشركة</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">النوع</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">المبلغ (قروش)</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">المتاح بعدها</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">المحجوز بعدها</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fTxns.map((t) => (
                      <tr key={t.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-2.5">{t.company}</td>
                        <td className="px-4 py-2.5">{t.type}</td>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">محافظ الشركات</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <caption className="sr-only">محافظ الشركات</caption>
                  <thead>
                    <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-medium">الشركة</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">المتاح</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">المحجوز</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">الإيداعات</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">المكافآت</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">العمولات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.map((w) => (
                      <tr key={w.company_id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-2.5">{w.company_name}</td>
                        <td className="px-4 py-2.5 tabular-nums" dir="ltr">{formatMinor(w.available_minor)}</td>
                        <td className="px-4 py-2.5 tabular-nums" dir="ltr">{formatMinor(w.reserved_minor)}</td>
                        <td className="px-4 py-2.5 tabular-nums" dir="ltr">{formatMinor(w.deposits_minor)}</td>
                        <td className="px-4 py-2.5 tabular-nums" dir="ltr">{formatMinor(w.rewards_minor)}</td>
                        <td className="px-4 py-2.5 tabular-nums" dir="ltr">{formatMinor(w.fees_minor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">تسوية يدوية (تُسجَّل في الدفتر)</CardTitle>
              <CardDescription>استخدمها للتصحيحات الاستثنائية فقط — كل تسوية بند دفتر لا يمس ولا يُحذف.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={adjustCompanyWalletV2Action} className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor="adj-company" className="block text-xs font-bold text-muted-foreground">الشركة</label>
                  <select id="adj-company" name="company_id" required defaultValue="" className="mt-1 h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="" disabled>— اختر —</option>
                    {wallets.map((w) => <option key={w.company_id} value={w.company_id}>{w.company_name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="adj-amount" className="block text-xs font-bold text-muted-foreground">المبلغ (EGP، سالب للخصم)</label>
                  <Input id="adj-amount" name="amount" required dir="ltr" placeholder="-250 أو 500" className="h-9 w-36" />
                </div>
                <div>
                  <label htmlFor="adj-note" className="block text-xs font-bold text-muted-foreground">السبب</label>
                  <Input id="adj-note" name="note" required minLength={3} className="h-9 w-64" />
                </div>
                <ActionButton busy={pending} type="submit">تنفيذ التسوية</ActionButton>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

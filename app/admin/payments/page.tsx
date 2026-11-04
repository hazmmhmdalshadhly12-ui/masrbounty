import { revalidatePath } from 'next/cache';
import {
  Landmark, Wallet as WalletIcon, TrendingUp, ArrowDownLeft, ArrowUpRight,
  Hourglass, Scale, Settings2, ReceiptText,
} from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { approvePayoutAction, completePayoutAction } from '@/features/disputes/services';
import { reviewDepositAction, adjustWalletAction } from '@/features/finance/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/shared/stat-card';
import { StatusPill } from '@/components/shared/status-pill';
import { EmptyState } from '@/components/shared/empty-state';
import { money, moneyShort, aggregateMonthly, methodLabel, txnLabel } from '@/utils/finance';
import type { DepositRequest, LedgerEntry, PayoutRequest } from '@/types/wallet';

export const dynamic = 'force-dynamic';

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

async function setVfNumber(formData: FormData) {
  'use server';
  const value = String(formData.get('vf_cash_number') ?? '').trim().slice(0, 40);
  const supabase = await requireAdmin();
  await supabase.from('platform_settings').upsert({ key: 'vf_cash_number', value });
  revalidatePath('/admin/payments');
}

const STEPS: Record<string, string> = {
  pending: 'بانتظار اعتماد الإدارة',
  approved: 'معتمد — بانتظار تسجيل مرجع التحويل للباحث',
  processing: 'قيد التنفيذ',
  completed: 'مكتمل',
  rejected: 'مرفوض',
  failed: 'فاشل',
};

const dt = (s: string) => new Date(s).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const supabase = await requireAdmin();

  const [{ data: payouts }, { data: deposits }, { data: revenue }, { data: feeRow }, { data: vfRow },
    { data: cw }, { data: rw }, { data: rTxns }, { data: cTxns }, { data: researchers }, { data: companies }] = await Promise.all([
    supabase.from('payout_requests').select('*,payment_methods!fk_payout_method(label,type)').order('created_at', { ascending: false }).limit(60),
    supabase.from('deposit_requests').select('*,company_profiles!inner(name)').order('created_at', { ascending: false }).limit(60),
    supabase.from('platform_revenue').select('gross_amount,fee_amount,net_amount,created_at'),
    supabase.from('platform_settings').select('value').eq('key', 'platform_fee').maybeSingle(),
    supabase.from('platform_settings').select('value').eq('key', 'vf_cash_number').maybeSingle(),
    supabase.from('company_wallets').select('balance,total_funded,total_spent'),
    supabase.from('wallets').select('balance,pending_balance'),
    supabase.from('wallet_transactions').select('id,type,amount,balance_after,note,created_at,wallets!inner(researcher_id,researcher_profiles!inner(display_name))').order('created_at', { ascending: false }).limit(40),
    supabase.from('company_wallet_transactions').select('id,type,amount,balance_after,note,created_at,company_wallets!inner(company_id,company_profiles!inner(name))').order('created_at', { ascending: false }).limit(40),
    supabase.from('researcher_profiles').select('id,display_name').order('display_name').limit(300),
    supabase.from('company_profiles').select('id,name').order('name').limit(300),
  ]);

  const payoutRows = (payouts ?? []) as unknown as (PayoutRequest & { payment_methods: { label: string; type: string } | null })[];
  const depositRows = (deposits ?? []) as unknown as (DepositRequest & { company_profiles: { name: string } })[];
  const revRows = (revenue ?? []) as unknown as { gross_amount: string | number; fee_amount: string | number; net_amount: string | number; created_at: string }[];
  const totals = revRows.reduce(
    (a, r) => ({ gross: a.gross + Number(r.gross_amount), fee: a.fee + Number(r.fee_amount), net: a.net + Number(r.net_amount) }),
    { gross: 0, fee: 0, net: 0 }
  );
  const companyBalances = (cw ?? []).reduce((s, w: { balance: string | number }) => s + Number(w.balance), 0);
  const companyFunded = (cw ?? []).reduce((s, w: { total_funded: string | number }) => s + Number(w.total_funded), 0);
  const researcherEscrow = (rw ?? []).reduce((s, w: { pending_balance: string | number }) => s + Number(w.pending_balance), 0);
  const depositsApproved = depositRows.filter((d) => d.status === 'approved').reduce((s, d) => s + Number(d.amount), 0);
  const depositsPending = depositRows.filter((d) => d.status === 'pending').length;
  const payoutsCompleted = payoutRows.filter((p) => p.status === 'completed').reduce((s, p) => s + Number(p.amount), 0);
  const feePct = Number((feeRow?.value as { percent?: number } | null)?.percent ?? 10);
  const vfNumber = String((vfRow?.value as string | null) ?? '').replace(/"/g, '').trim();

  // Unified ledger: merge both ledgers, newest first
  const ledger: LedgerEntry[] = [
    ...((rTxns ?? []) as unknown as { id: string; type: string; amount: string | number; balance_after: string | number; note: string | null; created_at: string; wallets: { researcher_profiles: { display_name: string } } }[])
      .map((t) => ({ id: `r-${t.id}`, side: 'researcher' as const, owner_label: t.wallets?.researcher_profiles?.display_name ?? 'باحث', type: t.type as LedgerEntry['type'], amount: Number(t.amount), balance_after: Number(t.balance_after), note: t.note, created_at: t.created_at })),
    ...((cTxns ?? []) as unknown as { id: string; type: string; amount: string | number; balance_after: string | number; note: string | null; created_at: string; company_wallets: { company_profiles: { name: string } } }[])
      .map((t) => ({ id: `c-${t.id}`, side: 'company' as const, owner_label: t.company_wallets?.company_profiles?.name ?? 'شركة', type: t.type as LedgerEntry['type'], amount: Number(t.amount), balance_after: Number(t.balance_after), note: t.note, created_at: t.created_at })),
  ]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 40);

  const months = aggregateMonthly(
    depositRows.map((d) => ({ amount: d.amount, created_at: d.created_at })),
    revRows,
    payoutRows.map((p) => ({ amount: p.amount, created_at: p.created_at })),
    6
  );

  return (
    <div className="space-y-6 py-2" dir="rtl">
      <div>
        <h1 className="text-xl font-black tracking-tight">المالية والمدفوعات</h1>
        <p className="mt-1 text-sm text-muted-foreground">تحكم كامل في الإيداعات والسحوبات والتحويلات وتقارير إيراد المنصة.</p>
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {ok && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700" role="status">{ok}</p>}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إيراد المنصة (عمولة)" value={`${moneyShort(totals.fee)} EGP`} icon={TrendingUp} accent />
        <StatCard label="محافظ الشركات (أرصدة)" value={`${moneyShort(companyBalances)} EGP`} icon={WalletIcon} />
        <StatCard label="ضمان الباحثين (معلق)" value={`${moneyShort(researcherEscrow)} EGP`} icon={Hourglass} />
        <StatCard label="سحوبات مكتملة" value={`${moneyShort(payoutsCompleted)} EGP`} icon={ArrowUpRight} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي المكافآت" value={`${moneyShort(totals.gross)} EGP`} icon={ReceiptText} />
        <StatCard label="إيداعات معتمدة" value={`${moneyShort(depositsApproved)} EGP`} icon={ArrowDownLeft} />
        <StatCard label="طلبات إيداع معلقة" value={String(depositsPending)} icon={Hourglass} />
        <StatCard label="إجمالي تمويل الشركات" value={`${moneyShort(companyFunded)} EGP`} icon={Landmark} />
      </div>

      {/* Deposits review */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><ArrowDownLeft className="h-4 w-4 text-primary" /> طلبات إيداع الشركات</CardTitle>
          <CardDescription>تحقّق من التحويل في حساب المنصة ثم اعتمد الطلب — يُضاف للرصيد تلقائيًا.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!depositRows.length ? (
            <div className="p-4"><EmptyState title="لا طلبات إيداع" hint="ستظهر هنا طلبات شحن رصيد الشركات." /></div>
          ) : (
            <div className="divide-y">
              {depositRows.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 transition-colors hover:bg-muted/40">
                  <div className="text-sm">
                    <b className="tabular-nums" dir="ltr">{money(d.amount)} EGP</b>
                    {' '}— {d.company_profiles?.name} · {methodLabel(d.method)} · <span className="font-mono text-xs" dir="ltr">{d.reference}</span>
                    {' '}<StatusPill value={d.status} />
                    <span className="block text-xs text-muted-foreground">{dt(d.created_at)}{d.review_note ? ` · ${d.review_note}` : ''}</span>
                  </div>
                  {d.status === 'pending' && (
                    <div className="flex gap-2">
                      <form action={reviewDepositAction.bind(null, d.id, true)}>
                        <Button size="sm" type="submit" className="cursor-pointer font-bold">اعتماد وإضافة للرصيد ✓</Button>
                      </form>
                      <form action={reviewDepositAction.bind(null, d.id, false)}>
                        <Button size="sm" type="submit" variant="outline" className="cursor-pointer">رفض</Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payouts two-step */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><ArrowUpRight className="h-4 w-4 text-primary" /> طلبات سحب الباحثين — ضمان بخطوتين</CardTitle>
          <CardDescription>1) اعتماد الطلب (يُخصم من رصيد الباحث). 2) تحويل المبلغ وتسجيل المرجع. يمكن إلغاء طلب معتمد مع استرداد الرصيد.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!payoutRows.length ? (
            <div className="p-4"><EmptyState title="لا طلبات سحب" hint="ستظهر هنا طلبات سحب أرباح الباحثين." /></div>
          ) : (
            <div className="divide-y">
              {payoutRows.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 transition-colors hover:bg-muted/40">
                  <span className="text-sm">
                    <b className="tabular-nums" dir="ltr">{money(p.amount)} EGP</b> — <StatusPill value={p.status} />
                    {p.payment_methods && <span className="ml-2 text-muted-foreground">{p.payment_methods.label} ({p.payment_methods.type})</span>}
                    <span className="block text-xs text-muted-foreground">{STEPS[p.status] ?? p.status}</span>
                  </span>
                  {p.status === 'pending' && (
                    <span className="flex gap-2">
                      <form action={approvePayoutAction.bind(null, p.id, true)}>
                        <Button size="sm" type="submit" className="cursor-pointer font-bold">اعتماد السحب ✓</Button>
                      </form>
                      <form action={approvePayoutAction.bind(null, p.id, false)}>
                        <Button size="sm" type="submit" variant="outline" className="cursor-pointer">رفض</Button>
                      </form>
                    </span>
                  )}
                  {p.status === 'approved' && (
                    <span className="flex flex-wrap gap-2">
                      <form action={completePayoutAction.bind(null, p.id)} className="flex gap-2">
                        <Input name="reference" required maxLength={120} placeholder="مرجع التحويل للباحث" dir="ltr" className="h-9 w-48" aria-label="مرجع التحويل" />
                        <Button size="sm" type="submit" className="cursor-pointer font-bold">تم التحويل ✓</Button>
                      </form>
                      <form action={approvePayoutAction.bind(null, p.id, false)}>
                        <Button size="sm" type="submit" variant="outline" className="cursor-pointer">إلغاء واسترداد</Button>
                      </form>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Manual adjustment — researcher */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><Scale className="h-4 w-4 text-primary" /> تسوية محفظة باحث</CardTitle>
            <CardDescription>إضافة أو خصم رصيد — يُسجَّل في دفتر التحولات وسجل التدقيق مع السبب.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={adjustWalletAction} className="grid gap-3">
              <input type="hidden" name="subject" value="researcher" />
              <div>
                <label htmlFor="adj-r-id" className="text-xs font-bold text-muted-foreground">الباحث</label>
                <select id="adj-r-id" name="id" required className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {((researchers ?? []) as { id: string; display_name: string }[]).map((r) => (
                    <option key={r.id} value={r.id}>{r.display_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="adj-r-amount" className="text-xs font-bold text-muted-foreground">المبلغ (+ إضافة / − خصم)</label>
                  <Input id="adj-r-amount" name="amount" type="number" step="0.01" required dir="ltr" placeholder="-250" className="mt-1 tabular-nums" />
                </div>
                <div>
                  <label htmlFor="adj-r-note" className="text-xs font-bold text-muted-foreground">سبب التسوية *</label>
                  <Input id="adj-r-note" name="note" required minLength={3} maxLength={300} placeholder="تصحيح تحويل مكرر" className="mt-1" />
                </div>
              </div>
              <Button type="submit" variant="outline" className="cursor-pointer font-bold">تنفيذ التسوية</Button>
            </form>
          </CardContent>
        </Card>

        {/* Manual adjustment — company */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><Scale className="h-4 w-4 text-primary" /> تسوية محفظة شركة</CardTitle>
            <CardDescription>إضافة أو خصم رصيد شركة — يُسجَّل في دفتر التحولات وسجل التدقيق مع السبب.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={adjustWalletAction} className="grid gap-3">
              <input type="hidden" name="subject" value="company" />
              <div>
                <label htmlFor="adj-c-id" className="text-xs font-bold text-muted-foreground">الشركة</label>
                <select id="adj-c-id" name="id" required className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {((companies ?? []) as { id: string; name: string }[]).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="adj-c-amount" className="text-xs font-bold text-muted-foreground">المبلغ (+ إضافة / − خصم)</label>
                  <Input id="adj-c-amount" name="amount" type="number" step="0.01" required dir="ltr" placeholder="1000" className="mt-1 tabular-nums" />
                </div>
                <div>
                  <label htmlFor="adj-c-note" className="text-xs font-bold text-muted-foreground">سبب التسوية *</label>
                  <Input id="adj-c-note" name="note" required minLength={3} maxLength={300} placeholder="هدية افتتاح البرنامج" className="mt-1" />
                </div>
              </div>
              <Button type="submit" variant="outline" className="cursor-pointer font-bold">تنفيذ التسوية</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Platform settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><Settings2 className="h-4 w-4 text-primary" /> إعدادات المنصة المالية</CardTitle>
          <CardDescription>عمولة المنصة ورقم التحصيل المعتمد الذي يظهر للشركات.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-6">
          <form action={setFee} className="flex items-end gap-2">
            <div>
              <label htmlFor="fee" className="text-xs font-bold text-muted-foreground">العمولة الحالية: {feePct}% (0–50%)</label>
              <Input id="fee" name="percent" type="number" min={0} max={50} step={0.5} defaultValue={feePct} dir="ltr" className="mt-1 w-32 tabular-nums" />
            </div>
            <Button size="sm" type="submit" className="cursor-pointer">حفظ العمولة</Button>
          </form>
          <form action={setVfNumber} className="flex items-end gap-2">
            <div>
              <label htmlFor="vf" className="text-xs font-bold text-muted-foreground">رقم تحصيل فودافون كاش</label>
              <Input id="vf" name="vf_cash_number" defaultValue={vfNumber} dir="ltr" maxLength={40} placeholder="01xxxxxxxxx" className="mt-1 w-48 font-mono" />
            </div>
            <Button size="sm" type="submit" className="cursor-pointer">حفظ الرقم</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">التقرير المالي الشهري (آخر ٦ أشهر)</CardTitle>
          <CardDescription>الإيداعات المعتمدة مقابل حجم المكافآت وعمولة المنصة والسحوبات.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">التقرير المالي الشهري</caption>
              <thead>
                <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">الشهر</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">إيداعات</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">إجمالي مكافآت</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">عمولة المنصة</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">صافي الباحثين</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">سحوبات</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-medium">{m.label}</td>
                    <td className="px-4 py-2.5 tabular-nums" dir="ltr">{money(m.deposits)}</td>
                    <td className="px-4 py-2.5 tabular-nums" dir="ltr">{money(m.gross)}</td>
                    <td className="px-4 py-2.5 font-bold tabular-nums text-green-700 dark:text-green-400" dir="ltr">{money(m.fee)}</td>
                    <td className="px-4 py-2.5 tabular-nums" dir="ltr">{money(m.net)}</td>
                    <td className="px-4 py-2.5 tabular-nums" dir="ltr">{money(m.payouts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Unified ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">دفتر التحولات الموحّد (أحدث ٤٠ حركة)</CardTitle>
          <CardDescription>كل حركة على محافظ الباحثين والشركات مع الرصيد بعد كل عملية.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!ledger.length ? (
            <div className="p-4"><EmptyState title="لا حركات بعد" hint="أول إيداع أو مكافأة سيظهر هنا." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <caption className="sr-only">دفتر التحولات الموحد</caption>
                <thead>
                  <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">الجهة</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">النوع</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">المبلغ</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">الرصيد بعدها</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">البيان</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((t) => (
                    <tr key={t.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${t.side === 'company' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'}`}>
                          {t.side === 'company' ? 'شركة' : 'باحث'}
                        </span>
                        <span className="mr-1.5 text-xs text-muted-foreground">{t.owner_label}</span>
                      </td>
                      <td className="px-4 py-2.5">{txnLabel(t.type)}</td>
                      <td className={`px-4 py-2.5 font-bold tabular-nums ${t.amount < 0 ? 'text-red-600' : 'text-green-700 dark:text-green-400'}`} dir="ltr">
                        {t.amount > 0 ? '+' : ''}{money(t.amount)}
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
  );
}

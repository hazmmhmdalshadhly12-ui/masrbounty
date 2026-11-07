'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BadgeCheck, Loader2, ShieldAlert, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { egpToMinor, computeCommissionMinor, computeTotalMinor, bpToPercent, formatMinor } from '@/lib/finance/money';
import { approveBountyRewardAction, retryRewardPayoutAction } from '@/features/finance/company-actions';
import type { BountyReward } from '@/types/wallet';

const REWARD_STATE_AR: Record<string, string> = {
  reward_approved: 'معتمدة — بانتظار الصرف',
  awaiting_payout: 'بانتظار الصرف',
  processing: 'قيد التنفيذ',
  paid: 'مدفوعة',
  failed: 'فشل الصرف',
  cancelled: 'ملغاة',
};

/**
 * Company reward approval flow (spec A):
 *   amount -> live commission preview (rate LOCKED at approval) ->
 *   EXPLICIT confirmation checkbox -> reserve (reward + commission).
 * The idempotency key is generated once per mounted form so a double
 * click / retry can never reserve twice (the SQL RPC re-checks too).
 */
export function RewardApproval({
  reportId,
  reportStatus,
  rateBp,
  availableMinor,
  existingReward,
  canAct,
}: {
  reportId: string;
  reportStatus: string;
  rateBp: number | null;
  availableMinor: number | null;
  existingReward: BountyReward | null;
  canAct: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(`reward-ui:${reportId}:${Math.random().toString(36).slice(2)}${Date.now()}`);

  const preview = useMemo(() => {
    const minor = egpToMinor(amount);
    if (minor === null || rateBp === null) return null;
    const commission = computeCommissionMinor(minor, rateBp);
    const total = computeTotalMinor(minor, rateBp);
    return {
      minor,
      commission,
      total,
      sufficient: availableMinor === null ? true : availableMinor >= total,
    };
  }, [amount, rateBp, availableMinor]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || !confirm || busy) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('amount', amount);
      fd.set('confirm', 'true');
      fd.set('idempotency_key', idempotencyKey.current);
      await approveBountyRewardAction(reportId, fd);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تنفيذ العملية — حاول لاحقًا');
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!existingReward || busy) return;
    setBusy(true);
    setError(null);
    try {
      await retryRewardPayoutAction(existingReward.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إعادة الحجز');
    } finally {
      setBusy(false);
    }
  }

  // An approved reward already exists for this report — show its locked state.
  if (existingReward) {
    const locked = existingReward.commission_rate_bp;
    const payoutRetryable = existingReward.status === 'reward_approved';
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            مكافأة التقرير
            <Badge variant={existingReward.status === 'paid' ? 'default' : 'secondary'}>
              {REWARD_STATE_AR[existingReward.status] ?? existingReward.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <p>قيمة المكافأة: <b dir="ltr">{formatMinor(existingReward.reward_amount_minor)} EGP</b></p>
          <p>
            عمولة المنصة (مثبّتة {bpToPercent(locked)}%): <b dir="ltr">{formatMinor(existingReward.commission_amount_minor)} EGP</b>
            <span className="text-xs text-muted-foreground"> — يدفعها صاحب البرنامج فوق المكافأة</span>
          </p>
          <p>إجمالي ما حُجز من محفظتك: <b dir="ltr">{formatMinor(existingReward.total_charged_minor)} EGP</b></p>
          <p className="text-xs text-muted-foreground">
            النسبة مقفولة داخل هذه المعاملة منذ لحظة الاعتماد — تغيير نسبة العمولة لاحقًا لا يؤثر على هذه المكافأة.
          </p>
          {payoutRetryable && canAct && (
            <div className="pt-2">
              <Button size="sm" variant="outline" onClick={retry} disabled={busy}>
                {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                إعادة حجز المحفظة وإرسال مكافأة جديدة للصرف
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">استخدم هذا بعد فشل عملية الصرف أو إلغائها (تم إرجاع الحجز سابقًا).</p>
            </div>
          )}
          {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  if (reportStatus !== 'accepted') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">مكافأة التقرير</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            لاعتماد مكافأة، يجب أن يكون التقرير بحالة «مقبول» أولًا. الحالة الحالية:{' '}
            <Badge variant="outline">{reportStatus}</Badge>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (rateBp === null) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">مكافأة التقرير</CardTitle></CardHeader>
        <CardContent>
          <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            لم تُضبط نسبة عمولة المنصة بعد — لا يمكن اعتماد مكافآت حتى تضبطها الإدارة.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">اعتماد مكافأة (حجز من المحفظة)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="amount"
              inputMode="decimal"
              dir="ltr"
              required
              placeholder="المبلغ بالجنيه — مثال 1500 أو 1500.75"
              aria-label="مبلغ المكافأة بالجنيه"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1"
            />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" dir="ltr">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              {availableMinor === null ? '—' : `Available: ${formatMinor(availableMinor)} EGP`}
            </div>
          </div>

          {preview ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span>قيمة المكافأة للباحث</span>
                <b dir="ltr">{formatMinor(preview.minor)} EGP</b>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                <span>
                  عمولة المنصة ({bpToPercent(rateBp)}%)
                  <span className="text-xs text-muted-foreground"> — يدفعها صاحب البرنامج</span>
                </span>
                <b dir="ltr">{formatMinor(preview.commission)} EGP</b>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t pt-2">
                <span className="font-black">إجمالي الخصم من محفظتك</span>
                <b dir="ltr" className="text-base">{formatMinor(preview.total)} EGP</b>
              </div>
              {!preview.sufficient && (
                <p className="mt-2 flex items-start gap-1.5 text-sm font-bold text-red-600 dark:text-red-400">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  الرصيد المتاح لا يكفي —{' '}
                  <Link href="/company/payments" className="underline underline-offset-4">اشحن المحفظة</Link>
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">أدخل المبلغ لعرض العمولة والإجمالي قبل التأكيد.</p>
          )}

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border-2 border-amber-300 bg-amber-50/60 p-3 text-sm font-bold leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-amber-600"
              aria-label="تأكيد صريح لاعتماد المكافأة وحجز المبلغ"
              required
            />
            أؤكد صراحةً اعتماد هذه المكافأة على التقرير، وأوافق على حجز إجمالي المبلغ (المكافأة + العمولة) من محفظتي حتى اكتمال الصرف.
          </label>

          <Button
            type="submit"
            disabled={!preview || !preview.sufficient || !confirm || busy}
            className="w-full sm:w-auto"
          >
            {busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            اعتماد وحجز المبلغ
          </Button>
          <p className="text-xs text-muted-foreground">
            الاعتماد لا يصرف المبلغ فورًا: يُحجز حتى تنفّذ إدارة المنصة الدفع وتُرفق إثباتها. عند فشل الدفع يُعاد المبلغ المحجوز كاملًا.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

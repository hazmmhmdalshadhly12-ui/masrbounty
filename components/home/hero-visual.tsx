'use client';

import { ShieldCheck, FileText, Wallet, Activity, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useCountUp } from '@/hooks/use-count-up';
import { cn } from '@/lib/utils';

function Mini({ label, target, suffix = '' }: { label: string; target: number; suffix?: string }) {
  const { ref, value } = useCountUp(target);
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums" dir="ltr">
        <span ref={ref}>{value.toLocaleString()}</span>
        {suffix}
      </p>
    </div>
  );
}

/**
 * Illustrative dashboard preview for the landing hero.
 * The three counters (programs / reports / researchers) are live platform
 * statistics passed from the server; the activity rows and bar sparkline are
 * a clearly-labeled decorative UI illustration (not real per-item data).
 */
export function HeroVisual({ programs, reports, researchers }: { programs: number; reports: number; researchers: number }) {
  const bars = [42, 68, 55, 80, 64, 92, 74];
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-bl from-amber-400/10 to-transparent blur-2xl" aria-hidden />
      <Card className="relative shadow-2xl">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-amber-400">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-black">لوحة الأمان</p>
                <p className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> الأنظمة مراقبة
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Sparkles className="h-3 w-3" /> عرض توضيحي
            </span>
          </div>
          {/* Live platform statistics (server-provided) */}
          <div className="grid grid-cols-3 gap-2">
            <Mini label="البرامج" target={programs} />
            <Mini label="التقارير" target={reports} />
            <Mini label="الباحثون" target={researchers} />
          </div>
          {/* Decorative activity illustration — no real per-item values */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> نموذج النشاط <span className="rounded bg-muted px-1 text-[10px]">توضيحي</span>
            </div>
            <div className="space-y-1.5">
              {[
                [FileText, 'تقرير جديد — قيد الفرز'],
                [Wallet, 'مكافأة معتمدة — في طريقها للدفع'],
                [ShieldCheck, 'ثغرة حرجة — حُلّت'],
              ].map(([Icon, text], i) => {
                const I = Icon as typeof FileText;
                return (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-[11px]">
                    <I className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{text as string}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex h-16 items-end gap-1.5 rounded-lg border border-navy-700/50 p-3" dir="ltr" aria-hidden>
            {bars.map((h, i) => (
              <span
                key={i}
                className={cn('flex-1 rounded-sm transition-all duration-300', i === bars.length - 1 ? 'bg-amber-400' : 'bg-amber-400/25 dark:bg-amber-400/20')}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

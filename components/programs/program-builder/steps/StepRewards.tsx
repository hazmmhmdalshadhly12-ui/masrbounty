'use client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WizardData, Severity } from '../types';

const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  critical: { label: 'حرجة', color: 'bg-red-600 text-white' },
  high: { label: 'عالية', color: 'bg-orange-500 text-white' },
  medium: { label: 'متوسطة', color: 'bg-amber-500 text-white' },
  low: { label: 'منخفضة', color: 'bg-emerald-600 text-white' },
};

export function StepRewards({
  data,
  onChange,
  errors,
}: {
  data: WizardData['rewards'];
  onChange: (p: Partial<WizardData['rewards']>) => void;
  errors?: string[];
}) {
  const updatePolicy = (severity: Severity, patch: Partial<{ min_amount: number; max_amount: number }>) => {
    const policies = data.policies.map((p) => (p.severity === severity ? { ...p, ...patch } : p));
    onChange({ policies });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>المكافآت</CardTitle>
        <CardDescription>حدّد مبالغ المكافآت لكل مستوى خطورة — اختر بين مبلغ ثابت أو نطاق سعري</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {errors && errors.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <ul className="list-disc ps-5 space-y-1">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ bountyType: 'range' })}
            className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${data.bountyType === 'range' ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-accent'}`}
          >
            نطاق سعري (Range)
          </button>
          <button
            type="button"
            onClick={() => {
              // when switching to fixed, sync max = min
              const fixed = data.policies.map((p) => ({ ...p, max_amount: p.min_amount }));
              onChange({ bountyType: 'fixed', policies: fixed });
            }}
            className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${data.bountyType === 'fixed' ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-accent'}`}
          >
            مبلغ ثابت (Fixed)
          </button>
        </div>

        <div className="grid gap-4">
          {data.policies.map((pol) => {
            const meta = SEVERITY_META[pol.severity];
            return (
              <div key={pol.severity} className="rounded-lg border p-4 space-y-3 bg-muted/20 dark:bg-muted/10">
                <div className="flex items-center gap-2">
                  <Badge className={meta.color}>{meta.label}</Badge>
                  <span className="text-sm text-muted-foreground capitalize" dir="ltr">
                    {pol.severity}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>الحد الأدنى (USD)</Label>
                    <Input
                      type="number"
                      min={0}
                      dir="ltr"
                      value={pol.min_amount}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (data.bountyType === 'fixed') updatePolicy(pol.severity, { min_amount: v, max_amount: v });
                        else updatePolicy(pol.severity, { min_amount: v });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الحد الأقصى (USD)</Label>
                    <Input
                      type="number"
                      min={0}
                      dir="ltr"
                      value={pol.max_amount}
                      disabled={data.bountyType === 'fixed'}
                      onChange={(e) => updatePolicy(pol.severity, { max_amount: Number(e.target.value) })}
                    />
                  </div>
                </div>
                {pol.max_amount < pol.min_amount && <p className="text-xs text-destructive">الحد الأقصى يجب أن يكون ≥ الحد الأدنى</p>}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">سيتم حفظ هذه القيم في جدول bounty_policies لكل مستوى خطورة.</p>
      </CardContent>
    </Card>
  );
}

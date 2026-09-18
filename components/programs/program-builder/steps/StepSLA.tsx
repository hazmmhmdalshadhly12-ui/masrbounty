'use client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { WizardData } from '../types';

export function StepSLA({
  data,
  onChange,
  errors,
}: {
  data: WizardData['sla'];
  onChange: (p: Partial<WizardData['sla']>) => void;
  errors?: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>اتفاقية مستوى الخدمة (SLA)</CardTitle>
        <CardDescription>حدّد أزمنة الاستجابة والفرز والمعالجة — يراها الباحثون ويؤثر على ثقتهم ببرنامجك</CardDescription>
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

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="resp">زمن الاستجابة (ساعة) *</Label>
            <Input id="resp" type="number" min={1} max={720} dir="ltr" value={data.response_hours} onChange={(e) => onChange({ response_hours: Number(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground">الرد الأولي على التقرير</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="triage">زمن الفرز (ساعة) *</Label>
            <Input id="triage" type="number" min={1} max={720} dir="ltr" value={data.triage_hours} onChange={(e) => onChange({ triage_hours: Number(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground">تحديد القبول/الرفض</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resolve">زمن المعالجة (ساعة) *</Label>
            <Input id="resolve" type="number" min={1} max={2160} dir="ltr" value={data.resolution_hours} onChange={(e) => onChange({ resolution_hours: Number(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground">حتى الإصلاح والدفع</p>
          </div>
        </div>

        <div className="rounded-md border bg-muted/20 p-4 text-sm leading-relaxed dark:bg-muted/10">
          <p className="font-medium mb-1">معاينة للباحث:</p>
          <p className="text-muted-foreground">
            نستجيب خلال <strong className="text-foreground">{data.response_hours} ساعة</strong>، نفرز خلال{' '}
            <strong className="text-foreground">{data.triage_hours} ساعة</strong>، ونعالج خلال{' '}
            <strong className="text-foreground">{data.resolution_hours} ساعة</strong>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

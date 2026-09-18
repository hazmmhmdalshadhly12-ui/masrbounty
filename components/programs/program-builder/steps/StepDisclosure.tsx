'use client';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { WizardData } from '../types';

export function StepDisclosure({
  data,
  onChange,
  errors,
}: {
  data: WizardData['disclosure'];
  onChange: (p: Partial<WizardData['disclosure']>) => void;
  errors?: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الإفصاح والرؤية</CardTitle>
        <CardDescription>اختر من يمكنه رؤية البرنامج وكيف يتم الإفصاح عن الثغرات</CardDescription>
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

        <div className="space-y-3">
          <Label>الرؤية (Visibility)</Label>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { value: 'public' as const, title: 'عام — يظهر للجميع', desc: 'أي باحث يمكنه عرض البرنامج وتقديم تقارير' },
              { value: 'private' as const, title: 'خاص — بدعوة فقط', desc: 'الباحثون المدعوون فقط يمكنهم المشاركة' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ visibility: opt.value })}
                className={`text-start rounded-lg border p-4 transition-colors ${data.visibility === opt.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-input bg-background hover:bg-accent'}`}
              >
                <p className="font-medium text-sm">{opt.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>سياسة الإفصاح</Label>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { value: 'private' as const, title: 'خاص', desc: 'لا يُنشر — يبقى بين الشركة والباحث' },
              { value: 'coordinated' as const, title: 'منسّق', desc: 'نشر منسق بعد الإصلاح بفترة متفق عليها' },
              { value: 'public' as const, title: 'علني', desc: 'يمكن للباحث النشر بعد الإصلاح مباشرة' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ disclosureMode: opt.value })}
                className={`text-start rounded-lg border p-4 transition-colors ${data.disclosureMode === opt.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-input bg-background hover:bg-accent'}`}
              >
                <p className="font-medium text-sm">{opt.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

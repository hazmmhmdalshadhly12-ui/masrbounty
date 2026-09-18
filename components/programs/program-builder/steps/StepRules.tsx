'use client';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { WizardData } from '../types';

export function StepRules({
  data,
  onChange,
  errors,
}: {
  data: WizardData['rules'];
  onChange: (p: Partial<WizardData['rules']>) => void;
  errors?: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>القواعد وسياسات الاختبار</CardTitle>
        <CardDescription>وضّح ما هو مسموح وما هو محظور، وامنح الباحثين ملاذًا آمنًا عند الالتزام بالقواعد.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {errors && errors.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <ul className="list-disc ps-5 space-y-1">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="testing">قواعد الاختبار *</Label>
          <Textarea
            id="testing"
            value={data.testingRules}
            onChange={(e) => onChange({ testingRules: e.target.value })}
            placeholder="مثال: اختبر على الحسابات التجريبية فقط، لا تصل لبيانات مستخدمين حقيقيين، وثّق خطوات الاستغلال…"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="harbor">الملاذ الآمن (Safe Harbor) *</Label>
          <Textarea
            id="harbor"
            value={data.safeHarbor}
            onChange={(e) => onChange({ safeHarbor: e.target.value })}
            placeholder="مثال: عند الالتزام بهذه القواعد لن نتخذ إجراءات قانونية، وسنعتبر نشاطك بحثًا مصرحًا به…"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prohibited">المحظورات *</Label>
          <Textarea
            id="prohibited"
            value={data.prohibited}
            onChange={(e) => onChange({ prohibited: e.target.value })}
            placeholder="مثال: يحظر الـ DoS، الهندسة الاجتماعية، الوصول لبيانات الإنتاج، التخريب…"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="limits">حدود المعدل (Rate Limits) *</Label>
          <Textarea
            id="limits"
            value={data.rateLimits}
            onChange={(e) => onChange({ rateLimits: e.target.value })}
            placeholder="مثال: لا تتجاوز ٥٠ طلب/ثانية، استخدم الترويسة X-RateLimit، أوقف الاختبار عند 429…"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="disclosurePolicy">سياسة الإفصاح (اختياري)</Label>
          <Textarea
            id="disclosurePolicy"
            value={data.disclosurePolicy}
            onChange={(e) => onChange({ disclosurePolicy: e.target.value })}
            placeholder="مثال: نتبع الإفصاح المنسق — ٩٠ يومًا قبل النشر العلني، تواصل عبر security@example.com…"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}

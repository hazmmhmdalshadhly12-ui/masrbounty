'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Shield, Clock, Award, Eye, Lock } from 'lucide-react';
import type { WizardData } from '../types';

export function StepPreview({ data }: { data: WizardData }) {
  const severityLabels: Record<string, string> = { critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#0a1628] to-[#1e3a5f] dark:from-slate-900 dark:to-slate-800 flex items-center px-6 gap-4">
          {data.basic.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.basic.logo_url} alt={data.basic.name} className="h-14 w-14 rounded-lg bg-white object-contain p-1" />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-xl">
              {data.basic.name.slice(0, 2) || 'MB'}
            </div>
          )}
          <div className="text-white">
            <h3 className="text-xl font-bold">{data.basic.name || 'اسم البرنامج'}</h3>
            <p className="text-sm text-white/70 flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" />
              <span dir="ltr">{data.basic.website || 'example.com'}</span>
              {data.disclosure.visibility === 'private' ? <Lock className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {data.disclosure.visibility === 'private' ? 'خاص' : 'عام'}
            </p>
          </div>
          <div className="ms-auto hidden md:flex gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/20">
              {data.disclosure.disclosureMode === 'private' ? 'إفصاح خاص' : data.disclosure.disclosureMode === 'coordinated' ? 'إفصاح منسق' : 'إفصاح علني'}
            </Badge>
          </div>
        </div>
        <CardContent className="pt-6 space-y-6">
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> الوصف
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {data.basic.description || 'لا يوجد وصف بعد — سيظهر هنا وصف البرنامج للباحثين.'}
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">الأصول</h4>
            <div className="flex flex-wrap gap-2">
              {data.scope.assets.filter((a) => a.value).map((a) => (
                <Badge key={a.id} variant="outline" className="font-mono text-xs" dir="ltr">
                  {a.type}: {a.value}
                </Badge>
              ))}
              {data.scope.assets.every((a) => !a.value) && <span className="text-sm text-muted-foreground">لم تُحدد أصول بعد</span>}
            </div>
            {data.scope.out_of_scope && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                <span className="font-medium">خارج النطاق:</span> {data.scope.out_of_scope}
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" /> المكافآت
              </h4>
              <div className="space-y-2">
                {data.rewards.policies.map((p) => (
                  <div key={p.severity} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-muted/20">
                    <span>{severityLabels[p.severity] ?? p.severity}</span>
                    <span dir="ltr" className="font-mono font-medium">
                      {p.min_amount === p.max_amount ? `$${p.min_amount}` : `$${p.min_amount} – $${p.max_amount}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" /> اتفاقية الخدمة
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between rounded-md border px-3 py-2 bg-muted/20">
                  <span>الاستجابة</span>
                  <span className="font-medium">{data.sla.response_hours} ساعة</span>
                </li>
                <li className="flex justify-between rounded-md border px-3 py-2 bg-muted/20">
                  <span>الفرز</span>
                  <span className="font-medium">{data.sla.triage_hours} ساعة</span>
                </li>
                <li className="flex justify-between rounded-md border px-3 py-2 bg-muted/20">
                  <span>المعالجة</span>
                  <span className="font-medium">{data.sla.resolution_hours} ساعة</span>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">القواعد</h4>
            <div className="grid gap-3 text-sm">
              {data.rules.testingRules && (
                <div className="rounded-md border p-3">
                  <p className="font-medium">قواعد الاختبار</p>
                  <p className="text-muted-foreground whitespace-pre-wrap mt-1">{data.rules.testingRules}</p>
                </div>
              )}
              {data.rules.safeHarbor && (
                <div className="rounded-md border p-3 bg-emerald-50 dark:bg-emerald-950/20">
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">الملاذ الآمن</p>
                  <p className="text-muted-foreground whitespace-pre-wrap mt-1">{data.rules.safeHarbor}</p>
                </div>
              )}
              {(data.rules.prohibited || data.rules.rateLimits) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.rules.prohibited && (
                    <div className="rounded-md border p-3">
                      <p className="font-medium">المحظورات</p>
                      <p className="text-muted-foreground whitespace-pre-wrap mt-1 text-xs">{data.rules.prohibited}</p>
                    </div>
                  )}
                  {data.rules.rateLimits && (
                    <div className="rounded-md border p-3">
                      <p className="font-medium">حدود المعدل</p>
                      <p className="text-muted-foreground whitespace-pre-wrap mt-1 text-xs">{data.rules.rateLimits}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground">
            تواصل: <span dir="ltr">{data.basic.contact_email || '—'}</span> — هذه معاينة كما سيظهر للباحثين بعد النشر.
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">ملاحظة</CardTitle>
          <CardDescription>هذه معاينة تقريبية. بعد إنشاء المسودة ستنتقل لصفحة البرنامج حيث يمكنك استخدام checkPublishReadiness والتحقق من الجاهزية قبل النشر.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

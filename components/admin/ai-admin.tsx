'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateAiSettingsAction } from '@/features/ai/admin-actions';
import { toastSuccess, toastError } from '@/components/toasts/toast-utils';

export type AiUsageStat = { feature: string; total: number; failed: number };
export type AiUsageRow = {
  id: string;
  username: string;
  feature: string;
  model: string;
  ok: boolean;
  errorCode: string | null;
  createdAt: string;
};

export type AiSettingsShape = {
  enabled: boolean;
  daily_limit_per_user: number;
  per_minute_limit: number;
  monthly_budget_requests: number;
  allowed_features: string[];
  default_model: string;
};

const FEATURES = [
  { id: 'report_assistant', label: 'مساعد كتابة التقارير' },
  { id: 'lesson_generator', label: 'مولّد الدروس التعليمية' },
];

export function AiAdmin({
  isAdmin,
  settings,
  stats,
}: {
  isAdmin: boolean;
  settings: AiSettingsShape;
  stats: { monthTotal: number; byFeature: AiUsageStat[]; topUsers: { username: string; count: number }[]; recent: AiUsageRow[] };
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({ ...settings });
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    const res = await updateAiSettingsAction({
      enabled: form.enabled,
      daily_limit_per_user: Number(form.daily_limit_per_user),
      per_minute_limit: Number(form.per_minute_limit),
      monthly_budget_requests: Number(form.monthly_budget_requests),
      allowed_features: form.allowed_features as ('report_assistant' | 'lesson_generator')[],
      default_model: form.default_model.trim() || null,
    });
    if (res.ok) toastSuccess('حُفظت إعدادات الذكاء الاصطناعي');
    else toastError(res.error ?? 'فشل الحفظ');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">الإعدادات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} disabled={!isAdmin} />
            تفعيل ميزات الذكاء الاصطناعي للمنصة
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>الحد اليومي لكل مستخدم</Label><Input type="number" dir="ltr" value={form.daily_limit_per_user} onChange={(e) => setForm({ ...form, daily_limit_per_user: Number(e.target.value) })} disabled={!isAdmin} /></div>
            <div><Label>الحد الأقصى للطلبات (كل دقيقة/مستخدم)</Label><Input type="number" dir="ltr" value={form.per_minute_limit} onChange={(e) => setForm({ ...form, per_minute_limit: Number(e.target.value) })} disabled={!isAdmin} /></div>
            <div><Label>ميزانية المنصة الشهرية (طلب)</Label><Input type="number" dir="ltr" value={form.monthly_budget_requests} onChange={(e) => setForm({ ...form, monthly_budget_requests: Number(e.target.value) })} disabled={!isAdmin} /></div>
          </div>
          <div><Label>النموذج الافتراضي (يجب أن يطابق ما يوفره المزود)</Label><Input dir="ltr" value={form.default_model} onChange={(e) => setForm({ ...form, default_model: e.target.value })} placeholder="gpt-4o-mini" disabled={!isAdmin} /></div>
          <div>
            <Label className="mb-1.5 block">الميزات المسموح لها باستخدام AI:</Label>
            <div className="flex flex-wrap gap-3">
              {FEATURES.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.allowed_features.includes(f.id)}
                    disabled={!isAdmin}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        allowed_features: e.target.checked
                          ? [...form.allowed_features, f.id]
                          : form.allowed_features.filter((x) => x !== f.id),
                      })
                    }
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
          {isAdmin && (
            <Button type="button" onClick={save} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ الإعدادات
            </Button>
          )}
          {!isAdmin && <p className="text-xs text-muted-foreground">العرض فقط — التعديل للأدمن فقط.</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">استهلاك هذا الشهر: <span className="tabular-nums" dir="ltr">{stats.monthTotal}</span> طلب</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.byFeature.length === 0 ? (
              <p className="text-muted-foreground">لا استخدام مسجل بعد.</p>
            ) : (
              stats.byFeature.map((f) => (
                <div key={f.feature} className="flex items-center justify-between rounded border p-2 text-xs">
                  <span className="font-bold">{FEATURES.find((x) => x.id === f.feature)?.label ?? f.feature}</span>
                  <span className="text-muted-foreground">
                    <span dir="ltr" className="tabular-nums">{f.total}</span> طلب
                    {f.failed > 0 && <> • <span className="text-red-600" dir="ltr">{f.failed}</span> فاشل</>}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">أكثر المستخدمين استخدامًا (آخر 5000 سجل)</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            {stats.topUsers.length === 0 ? <p className="text-muted-foreground">—</p> : stats.topUsers.map((u) => (
              <div key={u.username} className="flex justify-between">
                <span dir="ltr">@{u.username}</span>
                <span className="tabular-nums" dir="ltr">{u.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">أحدث الطلبات (الخصوصية: لا محتوى ولا مفاتيح — بيانات استهلاك فقط)</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 text-xs">
          {stats.recent.length === 0 ? <p className="text-muted-foreground">لا سجلات بعد.</p> : stats.recent.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border p-2">
              <Badge variant={r.ok ? 'secondary' : 'default'} className={`text-[10px] ${r.ok ? '' : 'bg-red-600'}`}>{r.ok ? 'نجح' : (r.errorCode ?? 'فشل')}</Badge>
              <span dir="ltr">@{r.username}</span>
              <span className="text-muted-foreground">{FEATURES.find((x) => x.id === r.feature)?.label ?? r.feature}</span>
              <span className="text-muted-foreground" dir="ltr">{r.model}</span>
              <span className="mr-auto text-muted-foreground" dir="ltr">{new Date(r.createdAt).toLocaleString('ar-EG')}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

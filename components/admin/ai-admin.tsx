'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, CheckCircle2, Loader2, Save, Stethoscope, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateAiSettingsAction, aiDiagnosticsAction, aiListModelsAction, aiSetDefaultModelAction } from '@/features/ai/admin-actions';
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

export type AiEnvDiagnosticsShape = {
  configured: boolean;
  keyVar: string;
  baseUrl: string;
  chatEndpoint: string;
  baseUrlVar: string;
  rawBaseUrl: string;
  model: string;
  keyVarsPresent: Record<string, boolean>;
  baseUrlVarsPresent: Record<string, boolean>;
  modelVarPresent: boolean;
  deploySha: string;
};

const FEATURES = [
  { id: 'report_assistant', label: 'مساعد كتابة التقارير' },
  { id: 'lesson_generator', label: 'مولّد الدروس التعليمية' },
];

function DiagnosticsCard({ diag }: { diag: AiEnvDiagnosticsShape }) {
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    interpretation: string;
    latencyMs?: number;
    httpStatus?: number;
    detail?: string;
    targetUrl?: string;
  } | null>(null);

  async function runTest() {
    setTesting(true);
    setResult(null);
    const res = await aiDiagnosticsAction(true);
    if (!res.ok) {
      toastError(res.error ?? 'فشل التشخيص');
    } else if (res.test) {
      setResult({
        ok: res.test.ok,
        interpretation: res.test.interpretation,
        latencyMs: res.test.latencyMs,
        httpStatus: res.test.httpStatus,
        detail: res.test.detail,
        targetUrl: res.test.targetUrl,
      });
    }
    setTesting(false);
  }

  const keyNames = Object.keys(diag.keyVarsPresent);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Stethoscope className="h-4 w-4" /> تشخيص الاتصال — لماذا لا يعمل التوليد؟</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={diag.configured ? 'secondary' : 'default'} className={diag.configured ? '' : 'bg-red-600'}>
            {diag.configured ? 'الإعدادات مكتملة ✓' : 'الإعدادات غير مكتملة ✕'}
          </Badge>
          {diag.keyVar ? (
            <span className="text-xs text-muted-foreground">المفتاح مقروء من المتغير: <code dir="ltr" className="rounded bg-muted px-1">{diag.keyVar}</code></span>
          ) : (
            <span className="text-xs font-bold text-red-600">الخادم لا يرى أي متغير مفتاح</span>
          )}
          {diag.deploySha && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              <span dir="ltr">النسخة المنشورة: {diag.deploySha.slice(0, 7)}</span>
            </Badge>
          )}
        </div>
        <div className="grid gap-1 text-xs text-muted-foreground">
          <span>
            القيمة المخزنة في Cloudflare (<code dir="ltr">{diag.baseUrlVar || '— لم يُضف متغير عنوان —'}</code>):{' '}
            <span dir="ltr" className="tabular-nums">{diag.rawBaseUrl || '— (افتراضي المزود) —'}</span>
          </span>
          <span>الرابط بعد التصحيح التلقائي: <span dir="ltr" className="tabular-nums">{diag.baseUrl || '—'}</span></span>
          <span>النموذج الافتراضي: <span dir="ltr" className="tabular-nums">{diag.model || '—'}</span></span>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold">متغيرات المفتاح التي يراها الخادم (الأسماء فقط — القيم لا تُعرض أبدًا):</p>
          <div className="flex flex-wrap gap-1.5">
            {keyNames.map((n) => (
              <Badge key={n} variant="outline" className={`text-[10px] ${diag.keyVarsPresent[n] ? 'border-emerald-400 text-emerald-700' : 'text-muted-foreground'}`}>
                <span dir="ltr">{n}{diag.keyVarsPresent[n] ? ' ✓' : ''}</span>
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={runTest} disabled={testing} className="gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
            {testing ? 'جارٍ الاختبار…' : 'اختبار الاتصال الفعلي بالمزود'}
          </Button>
          {result && (
            <Badge variant={result.ok ? 'secondary' : 'default'} className={result.ok ? '' : 'bg-red-600'}>
              {result.ok ? `نجح (${result.latencyMs ?? 0}ms)` : `فشل${result.httpStatus ? ` — HTTP ${result.httpStatus}` : ''}`}
            </Badge>
          )}
        </div>
        {result && (
          <div className={`space-y-1.5 rounded-md border p-3 text-xs leading-relaxed ${result.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'}`}>
            <p>{result.interpretation}</p>
            {result.targetUrl && (
              <p className="text-muted-foreground">الرابط المستهدف للاختبار: <span dir="ltr" className="tabular-nums">{result.targetUrl}</span></p>
            )}
            {result.detail && (
              <p className="text-muted-foreground" dir="ltr">{result.detail}</p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">تنبيه: أي تغيير على متغيرات البيئة في Cloudflare Pages لا يسري إلا بعد إعادة نشر جديدة للموقع.</p>
      </CardContent>
    </Card>
  );
}

function ModelPickerCard({
  isAdmin,
  currentModel,
  activeModel,
  modelSource,
  envModel,
}: {
  isAdmin: boolean;
  currentModel: string;
  activeModel: string;
  modelSource: 'admin' | 'env';
  envModel: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string>(currentModel);
  const [manual, setManual] = React.useState('');
  const [models, setModels] = React.useState<string[]>([]);
  const [listing, setListing] = React.useState(false);
  const [listError, setListError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function fetchModels() {
    setListing(true);
    setListError('');
    const res = await aiListModelsAction();
    if (res.ok) {
      setModels(res.models);
    } else {
      setListError(res.error);
      setModels([]);
    }
    setListing(false);
  }

  async function saveModel(value: string | null) {
    setSaving(true);
    const res = await aiSetDefaultModelAction(value);
    if (res.ok) {
      toastSuccess(value ? `سيعمل النموذج «${value}» على كل ميزات AI فورًا` : 'أُلغي الاختيار — سيُستخدم النموذج الافتراضي من البيئة');
      setSelected(value ?? '');
      setManual('');
      router.refresh();
    } else {
      toastError(res.error ?? 'فشل الحفظ');
    }
    setSaving(false);
  }

  const chosen = manual.trim() || selected;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Boxes className="h-4 w-4" /> اختيار نموذج الذكاء الاصطناعي</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">النموذج الفعلي المستخدم الآن:</span>
          <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold">{activeModel || envModel || '—'}</code>
          {activeModel && (
            <Badge variant="outline" className="text-[10px]">{modelSource === 'admin' ? 'اختيار الأدمن' : 'من متغيرات البيئة'}</Badge>
          )}
        </div>
        {isAdmin ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={fetchModels} disabled={listing} className="gap-2">
                {listing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
                {listing ? 'جارٍ الجلب…' : 'جلب النماذج المتاحة من المزود'}
              </Button>
              <span className="text-xs text-muted-foreground">يعرض القائمة الفعلية لمفتاحك — لا تخمين ولا 404.</span>
            </div>
            {listError && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{listError}</p>
            )}
            {models.length > 0 && (
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
                {models.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted">
                    <input
                      type="radio"
                      name="ai-model-choice"
                      checked={selected === m && !manual.trim()}
                      onChange={() => {
                        setManual('');
                        setSelected(m);
                      }}
                      disabled={!isAdmin}
                    />
                    <span dir="ltr" className="tabular-nums">{m}</span>
                    {m === activeModel && <Badge variant="secondary" className="text-[10px]">مستخدم حاليًا</Badge>}
                  </label>
                ))}
              </div>
            )}
            <div>
              <Label>أو اكتب اسم النموذج يدويًا (إن لم تُدعم القائمة)</Label>
              <Input
                dir="ltr"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="gemini-2.5-flash"
                className="mt-1"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => saveModel(chosen.trim() || null)}
                disabled={saving || (!selected && !manual.trim())}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ النموذج المختار
              </Button>
              {(selected || manual.trim()) && (
                <Button type="button" variant="outline" onClick={() => saveModel(null)} disabled={saving} className="gap-2">
                  <XCircle className="h-4 w-4" /> إلغاء الاختيار (العودة للافتراضي)
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">الحفظ يسري فورًا على كل ميزات AI (توليد الدروس، مساعد التقارير، اختبار التشخيص) — بدون إعادة نشر.</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">العرض فقط — اختيار النموذج للأدمن فقط.</p>
        )}
        {chosen && chosen !== activeModel && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> سيُستخدم «<span dir="ltr">{chosen}</span>» بعد الحفظ.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AiAdmin({
  isAdmin,
  settings,
  stats,
  diagnostics,
  activeModel,
  modelSource,
}: {
  isAdmin: boolean;
  settings: AiSettingsShape;
  stats: { monthTotal: number; byFeature: AiUsageStat[]; topUsers: { username: string; count: number }[]; recent: AiUsageRow[] };
  diagnostics: AiEnvDiagnosticsShape;
  /** Resolved server-side: the model the next AI call will use + its source. */
  activeModel: string;
  modelSource: 'admin' | 'env';
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({ ...settings });
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    // NOTE: default_model is intentionally NOT sent here — it is owned by the
    // ModelPickerCard (aiSetDefaultModelAction) so saving settings can never
    // clobber the admin's model choice.
    const res = await updateAiSettingsAction({
      enabled: form.enabled,
      daily_limit_per_user: Number(form.daily_limit_per_user),
      per_minute_limit: Number(form.per_minute_limit),
      monthly_budget_requests: Number(form.monthly_budget_requests),
      allowed_features: form.allowed_features as ('report_assistant' | 'lesson_generator')[],
    });
    if (res.ok) toastSuccess('حُفظت إعدادات الذكاء الاصطناعي');
    else toastError(res.error ?? 'فشل الحفظ');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <DiagnosticsCard diag={diagnostics} />
      <ModelPickerCard
        isAdmin={isAdmin}
        currentModel={settings.default_model}
        activeModel={activeModel}
        modelSource={modelSource}
        envModel={diagnostics.model}
      />
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
          {/* model choice lives in ModelPickerCard above (aiSetDefaultModelAction) */}
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

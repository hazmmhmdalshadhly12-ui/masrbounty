'use client';

import { useEffect, useMemo, useState } from 'react';
import { createReportAction } from '@/features/reports/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CvssCalculator } from '@/components/reports/cvss-calculator';
import { AiReportAssistant } from '@/components/reports/ai-report-assistant';

const DRAFT_KEY = 'masrbounty-report-draft';
const MIN = { title: 10, summary: 20, description: 30, impact: 20, reproduction_steps: 20 } as const;

type Fields = Record<'program_id' | 'title' | 'summary' | 'vulnerability_type' | 'severity' | 'affected_asset' | 'description' | 'impact' | 'reproduction_steps' | 'remediation' | 'cvss_score' | 'cwe', string>;

const EMPTY: Fields = {
  program_id: '', title: '', summary: '', vulnerability_type: '', severity: 'medium',
  affected_asset: '', description: '', impact: '', reproduction_steps: '', remediation: '', cvss_score: '', cwe: '',
};

const STEPS = ['البرنامج', 'الثغرة', 'التفاصيل', 'الأثر', 'الأدلة', 'المراجعة'] as const;

function Counter({ value, min }: { value: string; min?: number }) {
  const ok = min == null || value.trim().length >= min;
  return (
    <span className={`text-[11px] tabular-nums ${ok ? 'text-muted-foreground' : 'font-bold text-red-600'}`} dir="ltr">
      {value.trim().length}{min != null ? `/${min}` : ''}
    </span>
  );
}

export function ReportCreateForm({ programs, teams = [] }: { programs: { id: string; name: string }[]; teams?: { id: string; name: string }[] }) {
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [confirm, setConfirm] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [scope, setScope] = useState<'personal' | 'team'>('personal');
  const [teamId, setTeamId] = useState('');

  // Draft autosave + recovery
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setFields({ ...EMPTY, ...(JSON.parse(raw) as Partial<Fields>) });
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(fields));
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [fields, dirty]);

  // Unsaved-changes warning
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFields((f) => ({ ...f, [k]: e.target.value }));
    setDirty(true);
  };

  const stepValid = useMemo(() => {
    switch (step) {
      case 0: return fields.program_id.length > 0 && (scope === 'personal' || teamId.length > 0);
      case 1:
        return fields.title.trim().length >= MIN.title && fields.vulnerability_type.trim().length >= 2 && fields.affected_asset.trim().length >= 2;
      case 2: return fields.summary.trim().length >= MIN.summary && fields.description.trim().length >= MIN.description;
      case 3: return fields.impact.trim().length >= MIN.impact && fields.reproduction_steps.trim().length >= MIN.reproduction_steps;
      case 4: return true;
      default: return confirm;
    }
  }, [step, fields, confirm, scope, teamId]);

  async function onSubmit(formData: FormData) {
    await createReportAction(formData);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle>تقرير جديد</CardTitle>
          <ol className="mt-4 flex items-center gap-1" aria-label="خطوات التقرير">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  aria-current={i === step ? 'step' : undefined}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    i < step ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : i === step ? 'bg-amber-400 text-slate-950' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </button>
                <span className={`hidden text-xs sm:block ${i === step ? 'font-bold' : 'text-muted-foreground'}`}>{label}</span>
                {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-border" />}
              </li>
            ))}
          </ol>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" dir="ltr" aria-hidden>
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </CardHeader>
        <CardContent>
          <form action={onSubmit} className="space-y-4">
            <input type="hidden" name="submission_scope" value={scope} />
            <input type="hidden" name="team_id" value={teamId} />
            {step === 0 && (
              <div>
                <Label htmlFor="f-program">البرنامج المستهدف</Label>
                <select id="f-program" name="program_id" required value={fields.program_id} onChange={set('program_id')} className="mt-1 h-10 w-full rounded-md border px-3">
                  <option value="" disabled>اختر برنامجًا نشطًا…</option>
                  {programs?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">اختبر فقط الأصول داخل نطاق هذا البرنامج.</p>
                {teams.length > 0 && (
                  <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-bold">نطاق التقديم</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${scope === 'personal' ? 'border-primary/50 bg-primary/5 font-medium' : ''}`}>
                        <input type="radio" name="scope-radio" checked={scope === 'personal'} onChange={() => setScope('personal')} className="h-3.5 w-3.5" />
                        إرسال بصفتي الشخصية
                      </label>
                      <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${scope === 'team' ? 'border-primary/50 bg-primary/5 font-medium' : ''}`}>
                        <input type="radio" name="scope-radio" checked={scope === 'team'} onChange={() => setScope('team')} className="h-3.5 w-3.5" />
                        إرسال باسم الفريق
                      </label>
                    </div>
                    {scope === 'team' && (
                      <select
                        aria-label="الفريق المقدّم"
                        value={teamId}
                        onChange={(e) => setTeamId(e.target.value)}
                        className="mt-2 h-10 w-full rounded-md border px-3 text-sm"
                      >
                        <option value="" disabled>اختر الفريق…</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                    {scope === 'team' && !teamId && (
                      <p className="mt-1 text-[11px] font-bold text-red-600">اختر الفريق المقدّم للتقرير قبل المتابعة.</p>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      التقارير باسم الفريق ترى أعضاءه المصرّح لهم فقط — واسمك يبقى مسجّلًا كمُرسِل فعلي.
                    </p>
                  </div>
                )}
              </div>
            )}
            {step === 1 && (
              <>
                <div>
                  <div className="flex justify-between"><Label htmlFor="f-title">عنوان الثغرة</Label><Counter value={fields.title} min={MIN.title} /></div>
                  <Input id="f-title" name="title" required minLength={MIN.title} value={fields.title} onChange={set('title')} className="mt-1" placeholder="مثال: XSS مخزنة في صفحة الملف الشخصي" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="f-type">نوع الثغرة</Label><Input id="f-type" name="vulnerability_type" required value={fields.vulnerability_type} onChange={set('vulnerability_type')} placeholder="XSS, SQLi, IDOR…" className="mt-1" /></div>
                  <div><Label htmlFor="f-sev">الخطورة</Label>
                    <select id="f-sev" name="severity" value={fields.severity} onChange={set('severity')} className="mt-1 h-10 w-full rounded-md border px-3">
                      <option value="informational">Informational</option><option value="low">Low</option>
                      <option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div><Label htmlFor="f-asset">الأصل المتأثر</Label><Input id="f-asset" name="affected_asset" required value={fields.affected_asset} onChange={set('affected_asset')} placeholder="https://…" dir="ltr" className="mt-1" /></div>
              </>
            )}
            {step === 2 && (
              <>
                <div>
                  <div className="flex justify-between"><Label htmlFor="f-summary">الملخص</Label><Counter value={fields.summary} min={MIN.summary} /></div>
                  <Textarea id="f-summary" name="summary" required value={fields.summary} onChange={set('summary')} className="mt-1" rows={3} />
                </div>
                <div>
                  <div className="flex justify-between"><Label htmlFor="f-desc">الوصف التفصيلي</Label><Counter value={fields.description} min={MIN.description} /></div>
                  <Textarea id="f-desc" name="description" required value={fields.description} onChange={set('description')} className="mt-1" rows={5} />
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div>
                  <div className="flex justify-between"><Label htmlFor="f-impact">الأثر الأمني</Label><Counter value={fields.impact} min={MIN.impact} /></div>
                  <Textarea id="f-impact" name="impact" required value={fields.impact} onChange={set('impact')} className="mt-1" rows={4} placeholder="ما الذي يستطيع المهاجم تحقيقه؟" />
                </div>
                <div>
                  <div className="flex justify-between"><Label htmlFor="f-repro">خطوات الاستنساخ</Label><Counter value={fields.reproduction_steps} min={MIN.reproduction_steps} /></div>
                  <Textarea id="f-repro" name="reproduction_steps" required value={fields.reproduction_steps} onChange={set('reproduction_steps')} className="mt-1" rows={5} placeholder="1. … 2. … 3. …" />
                </div>
              </>
            )}
            {step === 4 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="f-cvss">CVSS (0–10)</Label><Input id="f-cvss" name="cvss_score" type="number" min={0} max={10} step={0.1} dir="ltr" value={fields.cvss_score} onChange={set('cvss_score')} className="mt-1" /></div>
                  <div>
                    <Label htmlFor="f-cwe">CWE (اختياري)</Label>
                    <Input id="f-cwe" name="cwe" list="cwe-list" dir="ltr" value={fields.cwe} onChange={set('cwe')} placeholder="CWE-79" className="mt-1" />
                    <datalist id="cwe-list">
                      <option value="CWE-79">XSS</option>
                      <option value="CWE-89">SQL Injection</option>
                      <option value="CWE-639">IDOR</option>
                      <option value="CWE-285">Improper Authorization</option>
                      <option value="CWE-287">Improper Authentication</option>
                      <option value="CWE-22">Path Traversal</option>
                      <option value="CWE-78">Command Injection</option>
                      <option value="CWE-434">Unrestricted Upload</option>
                      <option value="CWE-611">XXE</option>
                      <option value="CWE-918">SSRF</option>
                      <option value="CWE-352">CSRF</option>
                      <option value="CWE-307">Missing Rate Limit</option>
                    </datalist>
                  </div>
                </div>
                <div><Label htmlFor="f-fix">الإصلاح المقترح (اختياري)</Label><Textarea id="f-fix" name="remediation" value={fields.remediation} onChange={set('remediation')} className="mt-1" rows={2} /></div>
                <p className="rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                  بعد إنشاء المسودة ستتمكن من إرفاق لقطات الشاشة وملفات الإثبات (PNG/JPG/PDF حتى 10MB) من صفحة التقرير.
                </p>
              </>
            )}
            {step === 5 && (
              <div className="space-y-3 text-sm">
                {(Object.keys(EMPTY) as (keyof Fields)[]).map((k) => (
                  <input key={k} type="hidden" name={k} value={fields[k]} />
                ))}
                <dl className="divide-y rounded-md border">
                  {([
                    ['البرنامج', programs.find((p) => p.id === fields.program_id)?.name ?? '—'],
                    ['العنوان', fields.title],
                    ['النوع / الخطورة', `${fields.vulnerability_type} / ${fields.severity}`],
                    ['الأصل', fields.affected_asset],
                    ['CVSS', fields.cvss_score || '—'],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-3 py-2">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="max-w-[60%] truncate text-left font-medium" dir="auto">{v}</dd>
                    </div>
                  ))}
                </dl>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
                  <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 h-4 w-4" />
                  أقر بأن الاختبار تم داخل النطاق المصرح فقط، وأن المعلومات صحيحة على حد علمي.
                </label>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                السابق
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" disabled={!stepValid} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                  التالي
                </Button>
              ) : (
                <Button type="submit" disabled={!stepValid} className="bg-slate-900 font-bold text-white hover:bg-slate-700">
                  إنشاء كمسودة
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <CvssCalculator onPick={(s) => { setFields((f) => ({ ...f, cvss_score: String(s) })); setDirty(true); }} />
        <AiReportAssistant
          fields={{
            title: fields.title,
            summary: fields.summary,
            vulnerability_type: fields.vulnerability_type,
            severity: fields.severity,
            affected_asset: fields.affected_asset,
            description: fields.description,
            impact: fields.impact,
            reproduction_steps: fields.reproduction_steps,
            remediation: fields.remediation,
            cvss_score: fields.cvss_score,
          }}
          onApply={(k, v) => {
            setFields((f) => ({ ...f, [k]: v }));
            setDirty(true);
          }}
        />
      </div>
    </div>
  );
}

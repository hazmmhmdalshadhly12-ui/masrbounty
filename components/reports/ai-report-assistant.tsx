'use client';

import * as React from 'react';
import { Sparkles, Loader2, Check, X, Copy, RefreshCw, Info, Wand2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  aiReportAssistAction,
  getReportAssistantStatusAction,
  type ReportAssistantTask,
  type AssistantActionResult,
} from '@/features/ai/report-assistant';
import { toastSuccess, toastError } from '@/components/toasts/toast-utils';

export type AssistantFields = Record<
  'title' | 'summary' | 'vulnerability_type' | 'severity' | 'affected_asset' | 'description' | 'impact' | 'reproduction_steps' | 'remediation' | 'cvss_score',
  string
>;

type TaskDef = {
  id: ReportAssistantTask;
  label: string;
  /** Field the suggestion would be applied to (empty = informational). */
  target: '' | keyof AssistantFields | 'severity';
  needsField?: keyof AssistantFields;
  needsNotes?: boolean;
};

const TASKS: TaskDef[] = [
  { id: 'improve_title', label: 'تحسين العنوان', target: 'title', needsField: 'title' },
  { id: 'improve_summary', label: 'تحسين الملخص', target: 'summary', needsField: 'summary' },
  { id: 'improve_description', label: 'تحسين الوصف', target: 'description', needsField: 'description' },
  { id: 'organize_steps', label: 'تنظيم خطوات الاستنساخ', target: 'reproduction_steps', needsField: 'reproduction_steps' },
  { id: 'improve_impact', label: 'تحسين الأثر', target: 'impact', needsField: 'impact' },
  { id: 'improve_remediation', label: 'اقتراح الإصلاح', target: 'remediation', needsField: 'impact' },
  { id: 'suggest_severity_cwe', label: 'اقتراح الخطورة وCWE', target: 'severity', needsField: 'description' },
  { id: 'review_gaps', label: 'مراجعة المعلومات الناقصة', target: '', needsField: 'description' },
  { id: 'polish_language', label: 'تحسين اللغة', target: 'description', needsField: 'description' },
  { id: 'summarize_for_company', label: 'تلخيص للشركة', target: 'summary', needsField: 'description' },
  { id: 'redact_sensitive', label: 'إخفاء البيانات الحساسة', target: 'description', needsField: 'description' },
  { id: 'structure_notes', label: 'تحويل ملاحظات مبعثرة لتقرير', target: 'description', needsNotes: true },
];

export function AiReportAssistant({
  fields,
  onApply,
}: {
  fields: AssistantFields;
  onApply: (field: keyof AssistantFields, value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [statusLoaded, setStatusLoaded] = React.useState(false);
  const [available, setAvailable] = React.useState(true);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [busyTask, setBusyTask] = React.useState<ReportAssistantTask | null>(null);
  const [result, setResult] = React.useState<(Extract<AssistantActionResult, { ok: true }> & { taskDef: TaskDef }) | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notesInput, setNotesInput] = React.useState('');
  const [showNotesInput, setShowNotesInput] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    try {
      const st = await getReportAssistantStatusAction();
      setAvailable(st.available);
      setStatusMsg(st.message ?? null);
      setRemaining(st.remainingToday);
    } catch {
      setAvailable(false);
      setStatusMsg('تعذر التحقق من حالة المساعد');
    }
    setStatusLoaded(true);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !statusLoaded) void loadStatus();
  }

  const fieldOf = (t: TaskDef): string =>
    t.needsField ? (fields[t.needsField] ?? '').trim() : '';

  async function run(taskDef: TaskDef) {
    setBusyTask(taskDef.id);
    setError(null);
    setResult(null);
    try {
      const res = await aiReportAssistAction(taskDef.id, {
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
        target_field: taskDef.target,
        draft_notes: taskDef.needsNotes ? notesInput : '',
      });
      if (res.ok) {
        setResult({ ...res, taskDef });
        setRemaining(res.remainingToday);
      } else {
        setError(res.error);
        if (res.setupHint) setAvailable(false);
      }
    } catch {
      setError('تعذر تنفيذ الطلب — أعد المحاولة');
    } finally {
      setBusyTask(null);
    }
  }

  function accept() {
    if (!result) return;
    const t = result.taskDef;
    if (t.id === 'suggest_severity_cwe') {
      if (result.severity) onApply('severity', result.severity);
      toastSuccess('تم تطبيق الخطورة المقترحة — راجعها قبل الإرسال');
    } else if (t.target && t.target !== 'severity') {
      onApply(t.target, result.suggestion);
      toastSuccess('تم تطبيق الاقتراح — يمكنك تعديله يدويًا');
    } else {
      // informational tasks (review_gaps): copy instead of apply
      void navigator.clipboard.writeText(result.suggestion);
      toastSuccess('تم نسخ المراجعة');
    }
    setResult(null);
  }

  const visibleTasks = TASKS.filter((t) => {
    if (t.needsNotes) return true;
    if (t.needsField) return fieldOf(t).length > 0 || t.needsField === 'impact' || t.needsField === 'description';
    return true;
  });

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-2 text-start" aria-expanded={open}>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-amber-500" />
            مساعدة الذكاء الاصطناعي
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">{open ? 'إغلاق' : 'متاح'}</Badge>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {!statusLoaded ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ التحقق…</p>
          ) : !available ? (
            <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {statusMsg ?? 'المساعد غير متاح حاليًا.'} يمكنك إكمال التقرير يدويًا بشكل طبيعي.
            </p>
          ) : (
            <>
              {remaining != null && (
                <p className="text-[11px] text-muted-foreground" dir="rtl">
                  رصيدك اليوم: <span className="font-bold tabular-nums" dir="ltr">{remaining}</span> طلب
                </p>
              )}

              {showNotesInput && (
                <div className="space-y-1.5 rounded-md border p-3">
                  <Label htmlFor="ai-notes" className="text-xs">الصق ملاحظاتك الخام (من غير تنظيم):</Label>
                  <Textarea id="ai-notes" value={notesInput} onChange={(e) => setNotesInput(e.target.value)} rows={4} className="text-sm" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                {visibleTasks.map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    variant={t.id === 'structure_notes' ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-auto justify-start gap-1.5 px-2 py-1.5 text-xs"
                    disabled={busyTask !== null}
                    onClick={() => {
                      if (t.needsNotes) {
                        setShowNotesInput(true);
                        if (notesInput.trim().length > 10) void run(t);
                        return;
                      }
                      void run(t);
                    }}
                  >
                    {busyTask === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    {t.label}
                  </Button>
                ))}
              </div>

              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">{error}</p>
              )}

              {result && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold">
                    <ClipboardList className="h-3.5 w-3.5" /> اقتراح: {result.taskDef.label}
                  </p>

                  {result.taskDef.id === 'suggest_severity_cwe' ? (
                    <div className="space-y-2 text-sm" dir="auto">
                      <div className="flex flex-wrap items-center gap-2">
                        {result.severity && <Badge className="bg-amber-400 text-slate-950">الخطورة المقترحة: {result.severity}</Badge>}
                        {result.cwe && <Badge variant="outline" dir="ltr">{result.cwe}</Badge>}
                        {result.cvssEstimate != null && <Badge variant="outline" dir="ltr">CVSS ≈ {result.cvssEstimate.toFixed(1)}</Badge>}
                      </div>
                      {result.suggestion && <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{result.suggestion}</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {result.taskDef.target && fieldOf(result.taskDef) && (
                        <div>
                          <p className="mb-1 text-[10px] font-bold text-muted-foreground">النص الحالي:</p>
                          <div className="max-h-28 overflow-auto whitespace-pre-wrap rounded border bg-background p-2 text-xs leading-relaxed text-muted-foreground" dir="auto">
                            {fieldOf(result.taskDef)}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="mb-1 text-[10px] font-bold text-emerald-700">النص المقترح:</p>
                        <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded border bg-background p-2 text-sm leading-relaxed" dir="auto">
                          {result.suggestion}
                        </div>
                      </div>
                    </div>
                  )}

                  {result.notes && <p className="text-[11px] leading-relaxed text-muted-foreground">ملاحظة: {result.notes}</p>}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={accept}>
                      <Check className="h-3.5 w-3.5" />
                      {result.taskDef.id === 'review_gaps' ? 'نسخ المراجعة' : 'قبول وتطبيق'}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setResult(null)}>
                      <X className="h-3.5 w-3.5" /> رفض
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        void navigator.clipboard.writeText(result.suggestion);
                        toastSuccess('تم النسخ');
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> نسخ
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="gap-1" disabled={busyTask !== null} onClick={() => void run(result.taskDef)}>
                      <RefreshCw className="h-3.5 w-3.5" /> تحسين جديد
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    الاقتراحات استرشادية — راجعها وعدّلها يدويًا قبل الإرسال. المساعد لا يضيف أدلة أو نتائج اختبار لم تُنفّذ.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

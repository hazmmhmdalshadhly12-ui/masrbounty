'use client';

import * as React from 'react';
import { useWizardStore } from './store';
import { STEP_LABELS_AR, TOTAL_STEPS } from './types';
import type { WizardData } from './types';
import { wizardSchemas } from './validations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Check, UploadCloud, RotateCcw, History } from 'lucide-react';
import { loadWizardDraftAction, saveWizardDraftAction, clearWizardDraftAction } from './actions';
import { StepBasic } from './steps/StepBasic';
import { StepVerification } from './steps/StepVerification';
import { StepScope } from './steps/StepScope';
import { StepRules } from './steps/StepRules';
import { StepRewards } from './steps/StepRewards';
import { StepSLA } from './steps/StepSLA';
import { StepDisclosure } from './steps/StepDisclosure';
import { StepPreview } from './steps/StepPreview';
import { StepPublish } from './steps/StepPublish';

function getStepSlice(step: number, data: WizardData): unknown {
  switch (step) {
    case 1:
      return data.basic;
    case 2:
      return data.verification;
    case 3:
      return data.scope;
    case 4:
      return data.rules;
    case 5:
      return data.rewards;
    case 6:
      return data.sla;
    case 7:
      return data.disclosure;
    default:
      return undefined;
  }
}

function Stepper({ current }: { current: number }): React.JSX.Element {
  return (
    <div className="mb-6">
      <ol className="flex items-center justify-between gap-1 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
          const meta = STEP_LABELS_AR[n];
          if (!meta) return null;
          const status: 'done' | 'current' | 'pending' = n < current ? 'done' : n === current ? 'current' : 'pending';
          return (
            <React.Fragment key={n}>
              <li className="flex flex-1 min-w-[72px] flex-col items-center gap-1 text-center snap-start">
                <span
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black transition-colors shrink-0',
                    status === 'done' ? 'border-emerald-600 bg-emerald-600 text-white' : '',
                    status === 'current' ? 'border-primary bg-primary text-primary-foreground' : '',
                    status === 'pending' ? 'border-muted bg-muted text-muted-foreground' : '',
                  ].join(' ')}
                  aria-current={status === 'current' ? 'step' : undefined}
                  aria-label={`الخطوة ${n}: ${meta.title}${status === 'current' ? ' — الحالية' : status === 'done' ? ' — مكتملة' : ''}`}
                >
                  {status === 'done' ? <Check className="h-4 w-4" aria-hidden="true" /> : n}
                </span>
                <span className={['text-[11px] font-bold leading-tight line-clamp-1', status === 'current' ? 'text-foreground' : 'text-muted-foreground'].join(' ')}>
                  {meta.title}
                </span>
                <span className="hidden sm:block text-[10px] text-muted-foreground line-clamp-1">{meta.desc}</span>
              </li>
              {n < TOTAL_STEPS && <span className={['hidden h-0.5 flex-1 rounded sm:block', n < current ? 'bg-emerald-600' : 'bg-muted'].join(' ')} aria-hidden="true" />}
            </React.Fragment>
          );
        })}
      </ol>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-all" style={{ width: `${(current / TOTAL_STEPS) * 100}%` }} />
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        الخطوة {current} من {TOTAL_STEPS} — {STEP_LABELS_AR[current]?.title ?? ''}
      </p>
    </div>
  );
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function ProgramBuilderWizard(): React.JSX.Element {
  const { step, data, setStep, setData, next, back, updateBasic, updateScope, updateRules, updateRewards, updateSLA, updateDisclosure, reset } = useWizardStore();
  const [errors, setErrors] = React.useState<string[]>([]);
  const [createdProgramId, setCreatedProgramId] = React.useState<string | null>(null);

  // ── Backend draft: hydrate on mount + debounced autosave ──
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);
  const [lastSaved, setLastSaved] = React.useState<string | null>(null);
  const [resumed, setResumed] = React.useState(false);
  const hydratedRef = React.useRef(false);
  const snapshotRef = React.useRef('');
  const seqRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const res = await loadWizardDraftAction();
      if (!alive) return;
      if (res.ok && res.draft) {
        setData(res.draft.data);
        setStep(res.draft.step);
        setResumed(true);
        setLastSaved(res.draft.updatedAt || null);
      }
      hydratedRef.current = true;
      snapshotRef.current = JSON.stringify({ d: useWizardStore.getState().data, s: useWizardStore.getState().step });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!hydratedRef.current) return;
    if (createdProgramId) return; // draft consumed — stop autosaving
    const snap = JSON.stringify({ d: data, s: step });
    if (snap === snapshotRef.current) return;
    const seq = ++seqRef.current;
    setSaveState('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await saveWizardDraftAction(data, step);
      if (seq !== seqRef.current) return; // a newer save superseded this one
      if (res.ok) {
        snapshotRef.current = snap;
        setSaveState('saved');
        setSaveMsg(null);
        setLastSaved(res.savedAt);
      } else {
        setSaveState('error');
        setSaveMsg(res.error);
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, step, createdProgramId]);

  // Best-effort flush when the tab is closed/hidden — keeps "exit anytime" honest.
  React.useEffect(() => {
    const flush = (): void => {
      if (!hydratedRef.current || createdProgramId) return;
      const cur = useWizardStore.getState();
      const snap = JSON.stringify({ d: cur.data, s: cur.step });
      if (snap === snapshotRef.current) return;
      snapshotRef.current = snap;
      void saveWizardDraftAction(cur.data, cur.step);
    };
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [createdProgramId]);

  const startFresh = React.useCallback(async () => {
    await clearWizardDraftAction();
    snapshotRef.current = '';
    setResumed(false);
    setLastSaved(null);
    setSaveState('idle');
    reset();
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [reset, setStep]);

  const handleNext = (): void => {
    const slice = getStepSlice(step, data);
    const schema = wizardSchemas[step as keyof typeof wizardSchemas] as unknown as { safeParse: (v: unknown) => { success: boolean; error?: { errors: { message: string }[] } } } | undefined;
    if (schema) {
      const res = schema.safeParse(slice);
      if (!res.success) {
        const msgs: string[] = res.error ? res.error.errors.map((e) => e.message) : ['بيانات غير صالحة'];
        setErrors(msgs);
        return;
      }
    }
    setErrors([]);
    next();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = (): void => {
    setErrors([]);
    back();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStepClick = (target: number): void => {
    if (target === step) return;
    if (target < step) {
      setErrors([]);
      setStep(target);
      return;
    }
    // going forward: validate all intermediate steps
    for (let s = step; s < target; s++) {
      const slice = getStepSlice(s, data);
      const schema = wizardSchemas[s as keyof typeof wizardSchemas] as unknown as { safeParse: (v: unknown) => { success: boolean; error?: { errors: { message: string }[] } } } | undefined;
      if (schema) {
        const res = schema.safeParse(slice);
        if (!res.success) {
          const msgs: string[] = res.error ? res.error.errors.map((e) => e.message) : ['بيانات غير صالحة'];
          setErrors(msgs);
          setStep(s);
          return;
        }
      }
    }
    setErrors([]);
    setStep(target);
  };

  const isFirst = step === 1;
  const isLast = step === TOTAL_STEPS;

  return (
    <div className="space-y-6">
      <Stepper current={step} />

      {resumed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <span className="flex items-center gap-2">
            <History className="h-4 w-4 shrink-0" aria-hidden="true" />
            استأنفنا مسودتك المحفوظة على الخادم{lastSaved ? ` — آخر حفظ ${formatTime(lastSaved)}` : ''} — تابع من حيث توقفت.
          </span>
          <button
            type="button"
            onClick={() => void startFresh()}
            className="flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-xs font-medium transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-800 dark:hover:bg-amber-900/40"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            البدء من جديد
          </button>
        </div>
      )}

      {/* Stepper clickable pills for quick jump – visible on desktop */}
      <Card className="p-2">
        <div className="flex flex-wrap gap-1 justify-center max-sm:overflow-x-auto max-sm:flex-nowrap max-sm:justify-start max-sm:pb-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
            const active = n === step;
            return (
              <button
                key={n}
                type="button"
                onClick={() => handleStepClick(n)}
                className={[
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors border shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent border-input',
                ].join(' ')}
                aria-current={active ? 'step' : undefined}
                aria-label={`الانتقال إلى الخطوة ${n}: ${STEP_LABELS_AR[n]?.title ?? ''}`}
              >
                {n}. {STEP_LABELS_AR[n]?.title}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="min-h-[320px]">
        {step === 1 && <StepBasic data={data.basic} onChange={updateBasic} errors={errors} />}
        {step === 2 && <StepVerification errors={errors} />}
        {step === 3 && <StepScope data={data.scope} onChange={updateScope} errors={errors} />}
        {step === 4 && <StepRules data={data.rules} onChange={updateRules} errors={errors} />}
        {step === 5 && <StepRewards data={data.rewards} onChange={updateRewards} errors={errors} />}
        {step === 6 && <StepSLA data={data.sla} onChange={updateSLA} errors={errors} />}
        {step === 7 && <StepDisclosure data={data.disclosure} onChange={updateDisclosure} errors={errors} />}
        {step === 8 && <StepPreview data={data} />}
        {step === 9 && <StepPublish data={data} onCreated={setCreatedProgramId} />}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={handleBack} disabled={isFirst} className="gap-2 w-full sm:w-auto" aria-label="الرجوع للخطوة السابقة">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          رجوع
        </Button>

        <div className="flex items-center gap-2 justify-end">
          <span
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {saveState === 'saving' && (
              <>
                <UploadCloud className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
                جاري الحفظ على الخادم…
              </>
            )}
            {saveState === 'saved' && (
              <>
                <UploadCloud className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                محفوظ على الخادم{lastSaved ? ` ${formatTime(lastSaved)}` : ''} ✓
              </>
            )}
            {saveState === 'error' && (
              <span className="text-destructive">تعذر الحفظ: {saveMsg ?? 'خطأ غير متوقع'}</span>
            )}
            {saveState === 'idle' && !resumed && (
              <>
                <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                الحفظ التلقائي على الخادم مفعّل
              </>
            )}
          </span>
          {createdProgramId && step === 9 && (
            <a href={`/company/programs/${createdProgramId}`} className="text-xs text-primary hover:underline hidden sm:inline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              عرض البرنامج
            </a>
          )}
          {!isLast ? (
            <Button type="button" onClick={handleNext} className="gap-2 w-full sm:w-auto" aria-label="الانتقال للخطوة التالية">
              التالي
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">استخدم أزرار النشر داخل الخطوة ٩</span>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        تقدمك يُحفظ تلقائيًا في حسابك على الخادم — اخرج في أي وقت وارجع وستكمل من نفس الخطوة، وتوثيق الدومين يبقى محفوظًا. لا يُنشأ البرنامج إلا في خطوة النشر بعد التحقق عبر checkPublishReadiness.
      </p>
    </div>
  );
}

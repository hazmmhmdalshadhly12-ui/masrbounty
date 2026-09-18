'use client';

import * as React from 'react';
import { useWizardStore } from './store';
import { STEP_LABELS_AR, TOTAL_STEPS } from './types';
import type { WizardData } from './types';
import { wizardSchemas } from './validations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { StepBasic } from './steps/StepBasic';
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
      return data.scope;
    case 3:
      return data.rules;
    case 4:
      return data.rewards;
    case 5:
      return data.sla;
    case 6:
      return data.disclosure;
    default:
      return undefined;
  }
}

function Stepper({ current }: { current: number }): React.JSX.Element {
  return (
    <div dir="rtl" className="mb-6">
      <ol className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
          const meta = STEP_LABELS_AR[n];
          if (!meta) return null;
          const status: 'done' | 'current' | 'pending' = n < current ? 'done' : n === current ? 'current' : 'pending';
          return (
            <React.Fragment key={n}>
              <li className="flex flex-1 min-w-[72px] flex-col items-center gap-1 text-center">
                <span
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black transition-colors shrink-0',
                    status === 'done' ? 'border-emerald-600 bg-emerald-600 text-white' : '',
                    status === 'current' ? 'border-primary bg-primary text-primary-foreground' : '',
                    status === 'pending' ? 'border-muted bg-muted text-muted-foreground' : '',
                  ].join(' ')}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  {status === 'done' ? <Check className="h-4 w-4" /> : n}
                </span>
                <span className={['text-[11px] font-bold leading-tight line-clamp-1', status === 'current' ? 'text-foreground' : 'text-muted-foreground'].join(' ')}>
                  {meta.title}
                </span>
                <span className="hidden sm:block text-[10px] text-muted-foreground line-clamp-1">{meta.desc}</span>
              </li>
              {n < TOTAL_STEPS && <span className={['hidden h-0.5 flex-1 rounded sm:block', n < current ? 'bg-emerald-600' : 'bg-muted'].join(' ')} aria-hidden />}
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

export function ProgramBuilderWizard(): React.JSX.Element {
  const { step, data, setStep, next, back, updateBasic, updateScope, updateRules, updateRewards, updateSLA, updateDisclosure } = useWizardStore();
  const [errors, setErrors] = React.useState<string[]>([]);
  const [createdProgramId, setCreatedProgramId] = React.useState<string | null>(null);

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
    <div dir="rtl" className="space-y-6">
      <Stepper current={step} />

      {/* Stepper clickable pills for quick jump – visible on desktop */}
      <Card className="p-2">
        <div className="flex flex-wrap gap-1 justify-center">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
            const active = n === step;
            return (
              <button
                key={n}
                type="button"
                onClick={() => handleStepClick(n)}
                className={[
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent border-input',
                ].join(' ')}
                aria-current={active ? 'step' : undefined}
              >
                {n}. {STEP_LABELS_AR[n]?.title}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="min-h-[320px]">
        {step === 1 && <StepBasic data={data.basic} onChange={updateBasic} errors={errors} />}
        {step === 2 && <StepScope data={data.scope} onChange={updateScope} errors={errors} />}
        {step === 3 && <StepRules data={data.rules} onChange={updateRules} errors={errors} />}
        {step === 4 && <StepRewards data={data.rewards} onChange={updateRewards} errors={errors} />}
        {step === 5 && <StepSLA data={data.sla} onChange={updateSLA} errors={errors} />}
        {step === 6 && <StepDisclosure data={data.disclosure} onChange={updateDisclosure} errors={errors} />}
        {step === 7 && <StepPreview data={data} />}
        {step === 8 && <StepPublish data={data} onCreated={setCreatedProgramId} />}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={handleBack} disabled={isFirst} className="gap-2">
          <ChevronRight className="h-4 w-4" />
          رجوع
        </Button>

        <div className="flex items-center gap-2">
          {createdProgramId && step === 8 && (
            <a href={`/company/programs/${createdProgramId}`} className="text-xs text-primary hover:underline hidden sm:inline">
              عرض البرنامج
            </a>
          )}
          {!isLast ? (
            <Button type="button" onClick={handleNext} className="gap-2">
              التالي
              <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">استخدم أزرار النشر داخل الخطوة ٨</span>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        يتم حفظ البيانات محليًا أثناء التنقل بين الخطوات — لا يُنشأ البرنامج إلا في خطوة النشر بعد التحقق عبر{' '}
        <code dir="ltr" className="rounded bg-muted px-1 py-0.5">
          checkPublishReadiness
        </code>
      </p>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Loader2, Rocket } from 'lucide-react';
import type { WizardData } from '../types';
import { createWizardProgramAction, checkWizardReadinessAction, publishWizardProgramAction } from '../actions';

type Phase = 'idle' | 'creating' | 'checking' | 'publishing' | 'done' | 'error';

export function StepPublish({
  data,
  onCreated,
}: {
  data: WizardData;
  onCreated?: (programId: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [programId, setProgramId] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setPhase('creating');
    const res = await createWizardProgramAction(data);
    if (!res.ok) {
      setError(res.error);
      setPhase('error');
      return;
    }
    setProgramId(res.programId);
    onCreated?.(res.programId);
    setPhase('checking');
    const readiness = await checkWizardReadinessAction(res.programId);
    if (readiness.error) {
      setError(readiness.error);
      setPhase('error');
      return;
    }
    setMissing(readiness.missing);
    if (!readiness.ready) {
      setPhase('error');
      setError(`البرنامج غير جاهز للنشر:\n- ${readiness.missing.join('\n- ')}`);
      return;
    }
    setPhase('done');
  };

  const handlePublish = async () => {
    if (!programId) return;
    setPhase('publishing');
    setError(null);
    const res = await publishWizardProgramAction(programId);
    if (!res.ok) {
      setError(res.error);
      setPhase('error');
      return;
    }
    setPhase('done');
    // navigate to program page
    window.location.href = `/company/programs/${programId}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" /> النشر
        </CardTitle>
        <CardDescription>سيتم إنشاء البرنامج كمسودة، ثم التحقق عبر checkPublishReadiness، ثم نشره ليصبح نشطًا (active).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-wrap">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {missing.length > 0 && (
              <ul className="mt-2 list-disc ps-5">
                {missing.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {phase === 'done' && programId && missing.length === 0 && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            <div className="flex gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-medium">تم إنشاء المسودة بنجاح — البرنامج جاهز للنشر</p>
                <p className="text-xs mt-1">المعرّف: <span dir="ltr" className="font-mono">{programId}</span></p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-md border bg-muted/20 p-4 space-y-2 dark:bg-muted/10">
          <p className="text-sm font-medium">ما سيحدث عند الضغط على &quot;إنشاء المسودة&quot;:</p>
          <ol className="list-decimal ps-5 text-sm text-muted-foreground space-y-1">
            <li>إنشاء البرنامج في جدول programs بحالة draft</li>
            <li>حفظ الأصول في program_assets + القواعد في program_rules + المكافآت في bounty_policies</li>
            <li>استدعاء checkPublishReadiness للتحقق من الدومين الموثق والحقول المطلوبة</li>
            <li>عند الجاهزية، يمكنك الضغط على &quot;نشر الآن&quot; لاستدعاء publishProgramAction</li>
          </ol>
        </div>

        <div className="flex flex-col gap-3">
          {!programId ? (
            <Button onClick={handleCreate} disabled={phase === 'creating' || phase === 'checking'} className="w-full">
              {phase === 'creating' || phase === 'checking' ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Rocket className="me-2 h-4 w-4" />}
              {phase === 'creating' ? 'جاري الإنشاء…' : phase === 'checking' ? 'جاري التحقق…' : 'إنشاء المسودة والتحقق من الجاهزية'}
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">مسودة: {programId.slice(0, 8)}…</Badge>
                <a href={`/company/programs/${programId}`} className="text-primary hover:underline text-sm">
                  عرض البرنامج
                </a>
              </div>
              <Button onClick={handlePublish} disabled={phase === 'publishing'} className="w-full">
                {phase === 'publishing' ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="me-2 h-4 w-4" />}
                {phase === 'publishing' ? 'جاري النشر…' : 'نشر الآن (active)'}
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = `/company/programs/${programId}`)} className="w-full">
                الانتقال لصفحة البرنامج
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          ملاحظة: checkPublishReadiness يتحقق من (١) وجود دومين موثق للشركة (٢) الحقول المطلوبة و(٣) وجود سجلات في program_assets / program_rules / bounty_policies.
        </p>
      </CardContent>
    </Card>
  );
}

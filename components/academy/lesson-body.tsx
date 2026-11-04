'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, Award, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { completeLessonAction, saveQuizAttemptAction, getLessonMaterialUrlAction } from '@/features/academy/services';
import { toastSuccess, toastError } from '@/components/toasts/toast-utils';

export function LessonBody({
  lessonId,
  contentAr,
  videoUrl,
  attachmentPath,
  enrolled,
  completed,
  quizQuestions,
  quizPassScore,
}: {
  lessonId: string;
  contentAr: string | null;
  videoUrl: string | null;
  attachmentPath: boolean;
  enrolled: boolean;
  completed: boolean;
  quizQuestions: { q: string; options: string[] }[];
  quizPassScore: number;
}) {
  const router = useRouter();
  const [isCompleted, setIsCompleted] = React.useState(completed);
  const [percent, setPercent] = React.useState<number | null>(null);
  const [certNumber, setCertNumber] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [answers, setAnswers] = React.useState<number[]>(() => quizQuestions.map(() => -1));
  const [quizResult, setQuizResult] = React.useState<{ score: number; passed: boolean; perQuestion: boolean[]; explanations: (string | null)[]; passScore: number } | null>(null);
  const [quizBusy, setQuizBusy] = React.useState(false);
  const [materialBusy, setMaterialBusy] = React.useState(false);

  // YouTube-style embed: convert common watch URLs to privacy-safe embeds.
  const embedUrl = React.useMemo(() => {
    if (!videoUrl) return null;
    try {
      const u = new URL(videoUrl);
      if (u.hostname.includes('youtube.com')) {
        const v = u.searchParams.get('v');
        if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
      }
      if (u.hostname === 'youtu.be') {
        return `https://www.youtube-nocookie.com/embed${u.pathname}`;
      }
      return videoUrl;
    } catch {
      return null;
    }
  }, [videoUrl]);

  async function markComplete() {
    setBusy(true);
    const res = await completeLessonAction(lessonId);
    if (res.ok) {
      setIsCompleted(true);
      setPercent(res.percent ?? null);
      if (res.certificateNumber) {
        setCertNumber(res.certificateNumber);
        toastSuccess('🎉 أكملت جميع الدروس — صدرت شهادتك!');
      } else {
        toastSuccess('تم تسجيل إكمال الدرس');
      }
      router.refresh();
    } else {
      toastError(res.error ?? 'فشل تسجيل الإكمال');
    }
    setBusy(false);
  }

  async function submitQuiz() {
    setQuizBusy(true);
    const res = await saveQuizAttemptAction(lessonId, answers);
    if (res.ok) {
      setQuizResult(res);
      if (res.passed) toastSuccess(`نجحت! نتيجتك ${res.score}%`);
      else toastError(`النتيجة ${res.score}% — الحد الأدنى ${res.passScore}%، حاول مرة أخرى`);
    } else {
      toastError(res.error ?? 'فشل إرسال الإجابات');
    }
    setQuizBusy(false);
  }

  async function downloadMaterial() {
    setMaterialBusy(true);
    const res = await getLessonMaterialUrlAction(lessonId);
    if (res.ok && res.url) {
      window.open(res.url, '_blank', 'noopener');
    } else {
      toastError(res.error ?? 'تعذر فتح الملف');
    }
    setMaterialBusy(false);
  }

  const allAnswered = answers.every((a) => a >= 0);

  return (
    <div className="space-y-4">
      {embedUrl && (
        <div className="overflow-hidden rounded-lg border" dir="ltr">
          <div className="aspect-video w-full">
            <iframe
              src={embedUrl}
              title="فيديو الدرس"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      )}

      {contentAr ? (
        <Card>
          <CardContent className="p-5">
            <article className="whitespace-pre-wrap text-sm leading-8" dir="rtl">
              {contentAr}
            </article>
          </CardContent>
        </Card>
      ) : null}

      {/* Quiz */}
      {quizQuestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">اختبار قصير ({quizQuestions.length} أسئلة — الحد الأدنى {quizPassScore}%)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!quizResult ? (
              <>
                <p className="text-xs text-muted-foreground">اختر إجابة لكل سؤال ثم أرسل — التصحيح يتم على الخادم ولا تُرسل الإجابات الصحيحة للمتصفح.</p>
                {quizQuestions.map((qq, qi) => (
                  <fieldset key={qi} className="rounded-md border p-3">
                    <legend className="px-1 text-sm font-bold">{qi + 1}. {qq.q}</legend>
                    <div className="mt-2 space-y-1.5">
                      {qq.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={`flex cursor-pointer items-center gap-2 rounded border p-2 text-sm transition-colors ${answers[qi] === oi ? 'border-primary bg-primary/5 font-bold' : 'hover:bg-accent'}`}
                        >
                          <input
                            type="radio"
                            name={`q-${lessonId}-${qi}`}
                            checked={answers[qi] === oi}
                            onChange={() => setAnswers((a) => { const n = [...a]; n[qi] = oi; return n; })}
                            className="h-4 w-4"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <Button type="button" onClick={submitQuiz} disabled={quizBusy || !allAnswered} className="gap-2">
                  {quizBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  إرسال الإجابات
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-black tabular-nums ${quizResult.passed ? 'text-emerald-600' : 'text-amber-600'}`} dir="ltr">
                    {quizResult.score}%
                  </span>
                  <Badge variant="default" className={quizResult.passed ? 'bg-emerald-600' : 'bg-amber-500'}>
                    {quizResult.passed ? 'ناجح' : 'لم تجتز بعد'}
                  </Badge>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setQuizResult(null); setAnswers(quizQuestions.map(() => -1)); }}>
                    إعادة المحاولة
                  </Button>
                </div>
                <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                  {quizResult.perQuestion.map((ok, i) => (
                    <li key={i} className={ok ? 'text-emerald-600' : 'text-red-600'}>
                      سؤال {i + 1}: {ok ? 'صحيحة' : 'خاطئة'}{!ok && quizResult.explanations[i] ? ` — ${quizResult.explanations[i]}` : ''}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attachment */}
      {attachmentPath && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FileDown className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 text-sm">
              <p className="font-bold">ملف مرفق للدرس</p>
              <p className="text-xs text-muted-foreground">متاح للمسجلين في الدورة فقط عبر رابط مؤقت آمن (signed URL).</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={downloadMaterial} disabled={materialBusy || !enrolled} className="gap-1">
              {materialBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              تنزيل
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Completion */}
      {enrolled && (
        <Card className={isCompleted ? 'border-emerald-300' : ''}>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            {isCompleted ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="h-5 w-5 rounded-full border-2 border-dashed border-muted-foreground/40" />}
            <div className="flex-1">
              <p className="text-sm font-bold">{isCompleted ? 'أكملت هذا الدرس' : 'هل أنهيت هذا الدرس؟'}</p>
              {percent != null && (
                <div className="mt-1 max-w-xs space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" dir="ltr">
                    <div className="h-full bg-amber-400 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground tabular-nums">{percent}% من الدورة</p>
                </div>
              )}
            </div>
            {!isCompleted ? (
              <Button type="button" onClick={markComplete} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                تسجيل الإكمال
              </Button>
            ) : certNumber ? (
              <Link href={`/certificates/${certNumber}`}>
                <Button type="button" size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                  <Award className="h-4 w-4" /> شهادتي
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

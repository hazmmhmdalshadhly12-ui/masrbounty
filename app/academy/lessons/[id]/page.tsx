import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Clock, Target, FileDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAcademyLesson } from '@/features/academy/services';
import { LessonBody } from '@/components/academy/lesson-body';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getAcademyLesson(id);
  if (!res.ok || !res.lesson) notFound();
  const l = res.lesson;
  const neighbors = res.neighbors ?? { prevId: null, nextId: null };

  return (
    <div className="container max-w-4xl py-8">
      <Link href={`/academy/courses/${l.courseSlug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> {l.courseTitle}
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-black">{l.title_ar}</h1>
        <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {l.duration_minutes} دقيقة</Badge>
        {l.completed && <Badge className="bg-emerald-600">مكتمل ✓</Badge>}
      </div>

      {!res.enrolled && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          لست مسجلًا في هذه الدورة — سجّل من صفحة الدورة لتُحفظ إجاباتك وتقدمك وتحصل على الشهادة.
        </p>
      )}

      {l.objectives.length > 0 && (
        <Card className="mb-4 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4 text-primary" /> أهداف التعلم</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed">
              {l.objectives.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      <LessonBody
        lessonId={l.id}
        contentAr={l.content_ar}
        videoUrl={l.video_url}
        attachmentPath={Boolean(l.attachment_path)}
        enrolled={Boolean(res.enrolled)}
        completed={l.completed}
        quizQuestions={l.quizQuestions}
        quizPassScore={l.quiz_pass_score}
      />

      {l.attachment_path && (
        <Card className="mt-4">
          <CardContent className="flex items-center gap-3 p-4">
            <FileDown className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 text-sm">
              <p className="font-bold">ملف مرفق (PDF)</p>
              <p className="text-xs text-muted-foreground">متاح للمسجلين في الدورة فقط عبر رابط مؤقت آمن.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex justify-between">
        {neighbors.prevId ? (
          <Link href={`/academy/lessons/${neighbors.prevId}`}>
            <Button type="button" variant="outline" size="sm">الدرس السابق</Button>
          </Link>
        ) : <span />}
        {neighbors.nextId ? (
          <Link href={`/academy/lessons/${neighbors.nextId}`}>
            <Button type="button" size="sm">الدرس التالي</Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

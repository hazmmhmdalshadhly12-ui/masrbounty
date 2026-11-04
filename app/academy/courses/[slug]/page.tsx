import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, Clock, CheckCircle2, Circle, Award, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { getAcademyCourse } from '@/features/academy/services';
import { LEVEL_LABELS } from '@/features/academy/labels';
import { CourseActions } from '@/components/academy/course-actions';

export const dynamic = 'force-dynamic';

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await getAcademyCourse(slug);
  if (!res.ok || !res.course) notFound();
  const course = res.course;
  const lessons = res.lessons ?? [];

  return (
    <div className="container max-w-4xl py-8">
      <PageHeader icon={BookOpen} title={course.title_ar} desc={course.description_ar ?? undefined} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{LEVEL_LABELS[course.level] ?? course.level}</Badge>
        <Badge variant="secondary">{course.category}</Badge>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" /> {lessons.length} دروس
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {lessons.reduce((s, l) => s + l.duration_minutes, 0)} دقيقة
        </span>
        {course.is_free ? <Badge className="bg-emerald-600">مجانية</Badge> : <Badge variant="outline">مدفوعة</Badge>}
      </div>

      <CourseActions courseId={course.id} enrolled={Boolean(res.enrolled)} progressPercent={res.progressPercent ?? 0} />

      {res.myCertificates && res.myCertificates.length > 0 && (
        <Card className="mb-6 border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Award className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-bold">حصلت على شهادة هذه الدورة!</p>
            {res.myCertificates.map((n) => (
              <Link key={n} href={`/certificates/${n}`} className="text-xs font-bold text-emerald-700 underline" dir="ltr">
                {n}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">الدروس</CardTitle>
          {res.enrolled && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" dir="ltr">
                <div className="h-full bg-amber-400 transition-all" style={{ width: `${res.progressPercent ?? 0}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground tabular-nums">{res.progressPercent ?? 0}% مكتمل</p>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {lessons.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">لم تُنشر دروس هذه الدورة بعد.</p>
          ) : (
            lessons.map((l, i) => (
              <Link
                key={l.id}
                href={`/academy/lessons/${l.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{l.title_ar}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {l.duration_minutes} دقيقة{l.has_quiz ? ' • اختبار قصير' : ''}
                  </p>
                </div>
                {l.completed ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="مكتمل" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" aria-label="غير مكتمل" />
                )}
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Link href="/academy" className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> العودة إلى الأكاديمية
      </Link>
    </div>
  );
}

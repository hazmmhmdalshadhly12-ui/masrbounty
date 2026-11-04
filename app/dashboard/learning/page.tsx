import Link from 'next/link';
import { GraduationCap, Award, BookOpen, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { getMyLearningAction } from '@/features/academy/services';

export const dynamic = 'force-dynamic';

export default async function MyLearningPage() {
  const res = await getMyLearningAction();
  const courses = res.courses ?? [];
  const completed = courses.filter((c) => c.percent >= 100).length;
  const certificates = courses.filter((c) => c.certificateNumber);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={GraduationCap}
        title="مسار التعلم"
        desc="دوراتك وتقدمك ونتائج اختباراتك وشهاداتك — كل شيء محفوظ في حسابك."
        action={
          <Link href="/academy">
            <Button type="button" className="gap-2"><BookOpen className="h-4 w-4" /> استكشف الدورات</Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={BookOpen} label="دورات مسجّل بها" value={String(courses.length)} />
        <StatCard icon={Target} label="دورات مكتملة" value={String(completed)} />
        <StatCard icon={Award} label="شهادات مكتسبة" value={String(certificates.length)} />
      </div>

      {res.quizStats && res.quizStats.attempts > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm">
            <span className="font-bold">نتائج الاختبارات:</span>
            <span className="text-muted-foreground">محاولات: <strong className="tabular-nums" dir="ltr">{res.quizStats.attempts}</strong></span>
            <span className="text-muted-foreground">ناجحة: <strong className="tabular-nums text-emerald-600" dir="ltr">{res.quizStats.passed}</strong></span>
            <span className="text-muted-foreground">متوسط النتيجة: <strong className="tabular-nums" dir="ltr">{res.quizStats.avgScore}%</strong></span>
          </CardContent>
        </Card>
      )}

      {!res.ok ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{res.error}</p>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm text-muted-foreground">لم تسجل في أي دورة بعد.</p>
            <Link href="/academy" className="mt-3 inline-block"><Button type="button" size="sm">ابدأ التعلم الآن</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {courses.map((c) => (
            <Card key={c.course.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link href={`/academy/courses/${c.course.slug}`} className="hover:text-primary hover:underline">{c.course.title_ar}</Link>
                  </CardTitle>
                  {c.certificateNumber ? (
                    <Link href={`/certificates/${c.certificateNumber}`}>
                      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><Award className="h-3 w-3" /> شهادة: <span dir="ltr">{c.certificateNumber}</span></Badge>
                    </Link>
                  ) : c.percent >= 100 ? (
                    <Badge variant="secondary">مكتملة</Badge>
                  ) : (
                    <Badge variant="outline" className="tabular-nums">{c.percent}%</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" dir="ltr">
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${c.percent}%` }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

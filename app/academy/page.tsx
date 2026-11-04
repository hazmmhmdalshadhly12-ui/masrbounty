import Link from 'next/link';
import { BookOpen, Search, Clock, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHero } from '@/components/layout/page-hero';
import { listAcademyCourses, getMyLearningAction } from '@/features/academy/services';
import { LEVEL_LABELS } from '@/features/academy/labels';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const LEVEL_FILTERS = [
  { id: '', label: 'الكل' },
  { id: 'beginner', label: 'مبتدئ' },
  { id: 'intermediate', label: 'متوسط' },
  { id: 'advanced', label: 'متقدم' },
];

export default async function AcademyPage({
  searchParams,
}: {
  searchParams?: Promise<{ level?: string; q?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [catalog, learning] = await Promise.all([
    listAcademyCourses({ level: sp.level, q: sp.q }),
    getMyLearningAction(),
  ]);
  const myProgress = new Map<string, number>();
  if (learning.ok && learning.courses) {
    for (const c of learning.courses) myProgress.set(c.course.id, c.percent);
  }
  const courses = catalog.courses;
  const latest = [...courses].sort((a, b) => (a.sort_order - b.sort_order)).slice(-3).reverse();

  return (
    <div>
      <PageHero
        kicker="تعلّم · اختبر · اكسب"
        title="أكاديمية اختبار الاختراق"
        desc="مسارات تعليمية عملية لمهارات الأمن السيبراني واختبار الاختراق الأخلاقي — كل التدريبات في مختبرات محلية مصرح بها فقط."
      />
      <div className="container py-8">
      <Card className="mb-6 shadow-card">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <form className="relative flex-1" action="/academy">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="ابحث في الدورات… (مثال: XSS، أساسيات الشبكات)"
              className="ps-9"
              aria-label="بحث في الدورات"
            />
            {sp.level ? <input type="hidden" name="level" value={sp.level} /> : null}
          </form>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="المستوى">
            {LEVEL_FILTERS.map((f) => {
              const params = new URLSearchParams();
              if (f.id) params.set('level', f.id);
              if (sp.q) params.set('q', sp.q);
              const href = params.size ? `/academy?${params.toString()}` : '/academy';
              const active = (sp.level ?? '') === f.id;
              return (
                <Link
                  key={f.id || 'all'}
                  href={href}
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    'cursor-pointer rounded-lg border px-3.5 py-1.5 text-xs font-bold transition-all duration-200',
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-gold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* My progress strip */}
      {learning.ok && learning.courses && learning.courses.length > 0 && (
        <Card className="mb-6 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" /> تقدمك التعليمي
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {learning.courses.slice(0, 6).map((c) => (
              <Link key={c.course.id} href={`/academy/courses/${c.course.slug}`} className="group rounded-xl border bg-card p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card">
                <p className="truncate text-sm font-bold transition-colors group-hover:text-primary">{c.course.title_ar}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" dir="ltr">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all" style={{ width: `${c.percent}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{c.percent}% مكتمل{c.certificateNumber ? ' • 🎓 شهادة' : ''}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Courses */}
      {!catalog.ok ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{catalog.error ?? 'تعذر تحميل الدورات'}</p>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-40" />
            لا توجد دورات منشورة بهذه الفلاتر بعد — جرّب تصنيفًا آخر أو عد لاحقًا.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const percent = myProgress.get(c.id);
              return (
                <Link key={c.id} href={`/academy/courses/${c.slug}`} className="group">
                  <Card className="h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lift">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug transition-colors group-hover:text-primary">{c.title_ar}</CardTitle>
                        <Badge variant="info" className="shrink-0 text-[10px]">{LEVEL_LABELS[c.level] ?? c.level}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {c.description_ar && (
                        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{c.description_ar}</p>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" /> {c.lessonsCount} دروس
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {c.is_free ? 'مجانية' : 'مدفوعة'}
                        </span>
                      </div>
                      {percent != null && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted" dir="ltr">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400" style={{ width: `${percent}%` }} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {latest.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-black">آخر الدورات المضافة</h2>
              <div className="flex flex-wrap gap-2">
                {latest.map((c) => (
                  <Link key={c.id} href={`/academy/courses/${c.slug}`} className="rounded-full border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
                    {c.title_ar}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="mt-10 rounded-xl border border-warning/25 bg-warning/10 p-4 text-xs leading-relaxed text-foreground">
        <strong>تنبيه أخلاقي:</strong> كل ما تتعلمه هنا مخصص للاختبار داخل نطاقات مصرح بها أو مختبرات محلية. مهاجمة أنظمة بدون إذن مخالفة قانونية وأخلاقية وتؤدي إلى حظر الحساب.
      </p>
      </div>
    </div>
  );
}

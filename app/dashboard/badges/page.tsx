import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Award, Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type BadgeRow = {
  id: string;
  name_ar: string | null;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon: string | null;
};

type AchievementRow = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  created_at: string;
};

export default async function BadgesPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="container py-12">Login required.</div>;

  const [{ data: all }, { data: mine }] = await Promise.all([
    supabase.from('badges').select('*'),
    supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single(),
  ]);

  // Users without a researcher profile (e.g. company accounts) see a clear
  // completion prompt instead of crashing on the queries below.
  if (!mine) {
    return (
      <div className="container py-8">
        <PageHeader icon={Award} title="الشارات والإنجازات" desc="مسارك في المنصة ونقاط سمعتك." />
        <EmptyState
          title="لا يوجد ملف باحث مرتبط بحسابك"
          hint="الشارات تُمنح للباحثين الأمنيين. أنشئ ملف الباحث أولًا لبدء جمع الشارات والنقاط."
          action={
            <Button asChild>
              <Link href="/dashboard/settings">إكمال ملف الباحث</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const [earnedRes, achievementsRes] = await Promise.all([
    supabase.from('researcher_badges').select('badge_id').eq('researcher_id', mine.id),
    supabase
      .from('achievements')
      .select('id,title,description,points,created_at')
      .eq('researcher_id', mine.id)
      .order('created_at', { ascending: false }),
  ]);
  const earned = earnedRes.data ?? [];
  const achievements = (achievementsRes.data ?? []) as unknown as AchievementRow[];

  const set = new Set((earned as { badge_id: string }[]).map((e) => e.badge_id));
  const totalPoints = achievements.reduce((a, x) => a + Number(x.points), 0);

  return (
    <div className="container py-8">
      <PageHeader
        icon={Award}
        title="الشارات والإنجازات"
        desc="شارات المنصة وسجل إنجازاتك — تُمنح تلقائيًا وفق نشاطك."
        action={
          <p className="text-sm text-muted-foreground">
            نقاط الإنجاز: <b className="tabular-nums text-foreground">{totalPoints}</b>
          </p>
        }
      />

      {achievements.length > 0 && (
        <>
          <h2 className="mb-3 font-bold">سجل الإنجازات</h2>
          <div className="mb-8 space-y-2">
            {achievements.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold">{a.title}</p>
                    {a.description && <p className="text-muted-foreground">{a.description}</p>}
                  </div>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    +{a.points}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-3 font-bold">الشارات</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(all ?? []).map((b) => {
          const row = b as unknown as BadgeRow;
          const has = set.has(row.id);
          return (
            <Card key={row.id} className={has ? 'border-amber-400/60' : 'opacity-60'}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      has ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {has ? <Award className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </span>
                  {/* العربية أولًا مع الرجوع للإنجليزية */}
                  {row.name_ar || row.name_en}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{row.description_ar || row.description_en}</p>
                {has ? (
                  <Badge className="mt-3">مكتسبة ✓</Badge>
                ) : (
                  <Badge variant="secondary" className="mt-3">
                    مقفلة
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!(all ?? []).length && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState title="لا توجد شارات معرفة بعد" hint="ستظهر الشارات هنا فور إضافتها من إدارة المنصة." />
          </div>
        )}
      </div>
    </div>
  );
}

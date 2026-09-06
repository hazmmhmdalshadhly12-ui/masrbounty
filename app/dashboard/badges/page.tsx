import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function BadgesPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const [{ data: all }, { data: mine }] = await Promise.all([
    supabase.from('badges').select('*'),
    supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single(),
  ]);
  const [{ data: earned }, { data: achievements }] = mine ? await Promise.all([
    supabase.from('researcher_badges').select('badge_id').eq('researcher_id', mine.id),
    supabase.from('achievements').select('id,title,description,points,created_at').eq('researcher_id', mine.id).order('created_at', { ascending: false }),
  ]) : { data: [], achievements: [] } as never;
  const set = new Set(((earned ?? []) as { badge_id: string }[]).map((e) => e.badge_id));
  const totalPoints = ((achievements ?? []) as { points: number }[]).reduce((a, x) => a + Number(x.points), 0);
  return (
    <main className="container py-8">
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold">الشارات والإنجازات</h1>
        <p className="text-sm text-muted-foreground">نقاط الإنجاز: <b className="tabular-nums">{totalPoints}</b></p>
      </div>
      {!!(achievements ?? []).length && (
        <>
          <h2 className="mb-3 font-bold">سجل الإنجازات</h2>
          <div className="mb-8 space-y-2">
            {((achievements ?? []) as { id: string; title: string; description: string | null; points: number; created_at: string }[]).map((a) => (
              <Card key={a.id}><CardContent className="flex items-center justify-between p-3 text-sm">
                <div><p className="font-bold">{a.title}</p><p className="text-muted-foreground">{a.description}</p></div>
                <Badge variant="secondary">+{a.points}</Badge>
              </CardContent></Card>
            ))}
          </div>
        </>
      )}
      <h2 className="mb-3 font-bold">الشارات</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {all?.map((b) => <Card key={b.id} className={set.has(b.id) ? 'border-amber-400/60' : 'opacity-60'}><CardHeader><CardTitle className="text-base">{b.name_en}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{b.description_en}</p>{set.has(b.id) ? <Badge className="mt-2">مكتسبة ✓</Badge> : <Badge variant="secondary" className="mt-2">مقفلة</Badge>}</CardContent></Card>)}
      </div>
    </main>
  );
}

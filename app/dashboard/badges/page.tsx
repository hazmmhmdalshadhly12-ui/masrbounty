import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function BadgesPage() {
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const [{ data: all }, { data: mine }] = await Promise.all([
    supabase.from('badges').select('*'),
    supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single(),
  ]);
  const { data: earned } = mine ? await supabase.from('researcher_badges').select('badge_id').eq('researcher_id', mine.id) : { data: [] };
  const set = new Set((earned ?? []).map((e) => e.badge_id));
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">الشارات</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {all?.map((b) => <Card key={b.id} className={set.has(b.id) ? '' : 'opacity-50'}><CardHeader><CardTitle>{b.name_en}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{b.description_en}</p>{set.has(b.id) ? <Badge className="mt-2">Earned</Badge> : <Badge variant="secondary" className="mt-2">Locked</Badge>}</CardContent></Card>)}
      </div>
    </main>
  );
}

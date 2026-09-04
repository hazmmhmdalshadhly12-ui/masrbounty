import { Trophy, Medal } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';

export default async function LeaderboardPage() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('researcher_leaderboard').select('*').limit(50);
  return (
    <main>
      <PageHero kicker="التنافس الشريف" title="المتصدرين" desc="ترتيب الباحثين حسب نقاط السمعة — اكتشف أكثر، اصعد أعلى." />
      <section className="container max-w-3xl py-10">
        {!data?.length ? <p className="text-muted-foreground">No researchers yet.</p> : (
          <div className="space-y-2">
            {data.map((r: { researcher_id: string; display_name: string; score: number; rank: number }, i: number) => (
              <Card key={r.researcher_id} className={i < 3 ? 'border-amber-400/60 bg-amber-50 dark:bg-amber-950/20' : ''}>
                <CardContent className="flex items-center gap-4 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a1628] font-black text-amber-400">
                    {i < 3 ? <Medal className="h-5 w-5" /> : r.rank}
                  </span>
                  <span className="flex-1 font-bold">{r.display_name}</span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Trophy className="h-4 w-4 text-amber-500" /> {r.score}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

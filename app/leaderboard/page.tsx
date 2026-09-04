import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';

export default async function LeaderboardPage() {
  const supabase = createServerClient();
  const { data } = await supabase.from('researcher_leaderboard').select('*').limit(50);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">المتصدرين</h1>
      {!data?.length ? <p className="text-muted-foreground">No researchers yet.</p> : (
        <div className="space-y-2">
          {data.map((r: { researcher_id: string; display_name: string; score: number; rank: number }) => (
            <Card key={r.researcher_id}><CardContent className="p-3 flex justify-between"><span>#{r.rank} {r.display_name}</span><span>{r.score} pts</span></CardContent></Card>
          ))}
        </div>
      )}
    </main>
  );
}

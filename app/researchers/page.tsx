import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';

export default async function ResearchersPage() {
  const supabase = createServerClient();
  const { data } = await supabase.from('researcher_leaderboard').select('researcher_id,display_name,score,rank').limit(50);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">الباحثون</h1>
      {!data?.length ? <p className="text-muted-foreground">No public researchers.</p> :
        data.map((r: { researcher_id: string; display_name: string; score: number }) => (
          <Card key={r.researcher_id} className="mb-2"><CardContent className="p-3 flex justify-between"><span>{r.display_name}</span><span>{r.score} pts</span></CardContent></Card>
        ))}
      <p className="text-xs text-muted-foreground mt-4">Public profiles live at /researchers/[username].</p>
      <Link href="/leaderboard" className="underline text-sm">Full leaderboard</Link>
    </main>
  );
}

import Link from 'next/link';
import { UserSearch, Trophy } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';

export default async function ResearchersPage() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('researcher_leaderboard').select('researcher_id,display_name,score,rank').limit(50);
  return (
    <main>
      <PageHero kicker="مجتمع الصيادين" title="الباحثون" desc="تعرف على نخبة الباحثين الأمنيين في المنصة." />
      <section className="container max-w-3xl py-10">
        {!data?.length ? <p className="text-muted-foreground">No public researchers.</p> :
          data.map((r: { researcher_id: string; display_name: string; score: number }) => (
            <Card key={r.researcher_id} className="mb-2 transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0a1628] text-amber-400">
                  <UserSearch className="h-5 w-5" />
                </span>
                <span className="flex-1 font-bold">{r.display_name}</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Trophy className="h-4 w-4 text-amber-500" /> {r.score}
                </span>
              </CardContent>
            </Card>
          ))}
        <p className="mt-4 text-xs text-muted-foreground">Public profiles live at /researchers/[username].</p>
        <Link href="/leaderboard" className="text-sm underline">Full leaderboard</Link>
      </section>
    </main>
  );
}

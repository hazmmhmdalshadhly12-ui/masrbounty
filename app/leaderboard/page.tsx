import Link from 'next/link';
import { Trophy, Medal, Wallet, CheckCircle2 } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'reputation', label: 'السمعة', icon: Trophy },
  { key: 'earnings', label: 'الأرباح', icon: Wallet },
  { key: 'accepted', label: 'المقبولة', icon: CheckCircle2 },
] as const;

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ by?: string }> }) {
  const by = (await searchParams).by;
  const active: 'reputation' | 'earnings' | 'accepted' =
    by === 'earnings' ? 'earnings' : by === 'accepted' ? 'accepted' : 'reputation';
  const supabase = await createServerClient();
  const { data } = await supabase.from('researcher_leaderboard').select('*').limit(100);
  const rows = [...(data ?? [])].sort((a, b) => {
    if (active === 'earnings') return Number(b.total_earned) - Number(a.total_earned);
    if (active === 'accepted') return b.accepted_reports - a.accepted_reports;
    return b.score - a.score;
  });
  const metric = (r: { score: number; total_earned: number; accepted_reports: number }) =>
    active === 'earnings' ? `${r.total_earned} EGP` : active === 'accepted' ? `${r.accepted_reports} تقرير` : `${r.score} نقطة`;

  return (
    <main>
      <PageHero kicker="التنافس الشريف" title="المتصدرين" desc="ترتيب الباحثين — اختر المعيار المناسب." />
      <section className="container max-w-3xl py-10">
        <div className="mb-6 flex gap-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/leaderboard?by=${t.key}`}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-bold',
                active === t.key ? 'border-slate-900 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          ))}
        </div>
        {!rows.length ? <p className="text-muted-foreground">No researchers yet.</p> : (
          <div className="space-y-2">
            {rows.map((r: { researcher_id: string; display_name: string; score: number; rank: number; total_earned: number; accepted_reports: number }, i: number) => (
              <Card key={r.researcher_id} className={i < 3 ? 'border-amber-400/60 bg-amber-50 dark:bg-amber-950/20' : ''}>
                <CardContent className="flex items-center gap-4 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a1628] font-black text-amber-400">
                    {i < 3 ? <Medal className="h-5 w-5" /> : i + 1}
                  </span>
                  <span className="flex-1 font-bold">{r.display_name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{metric(r)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

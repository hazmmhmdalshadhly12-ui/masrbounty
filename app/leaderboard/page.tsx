import Link from 'next/link';
import { Trophy, Medal, Wallet, CheckCircle2 } from 'lucide-react';
import { Avatar } from '@/components/shared/avatar';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';
import { cn } from '@/lib/utils';

const tabs = [
  { key: 'reputation', label: 'السمعة', icon: Trophy },
  { key: 'earnings', label: 'الأرباح', icon: Wallet },
  { key: 'accepted', label: 'المقبولة', icon: CheckCircle2 },
] as const;

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ by?: string; period?: string }> }) {
  const { by, period = 'all' } = await searchParams;
  const active: 'reputation' | 'earnings' | 'accepted' =
    by === 'earnings' ? 'earnings' : by === 'accepted' ? 'accepted' : 'reputation';
  const supabase = await createServerClient();
  let rows: { researcher_id: string; display_name: string; score: number; rank: number; total_earned: number; accepted_reports: number }[] = [];
  if (period === 'all') {
    const { data } = await supabase.from('researcher_leaderboard').select('*').limit(100);
    rows = [...(data ?? [])].sort((a, b) => {
      if (active === 'earnings') return Number(b.total_earned) - Number(a.total_earned);
      if (active === 'accepted') return b.accepted_reports - a.accepted_reports;
      return b.score - a.score;
    });
  } else {
    // Period boards computed from dated activity (no snapshots needed)
    const now = new Date();
    const from = period === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      : new Date(now.getFullYear(), 0, 1).toISOString();
    const [{ data: reps }, { data: awards }] = await Promise.all([
      supabase.from('reports').select('researcher_id,status,created_at,researcher_profiles(display_name)').gte('created_at', from).neq('status', 'draft').limit(2000),
      supabase.from('bounty_awards').select('amount,created_at,report_id,reports!inner(researcher_id)').gte('created_at', from).in('status', ['approved', 'paid']).limit(2000),
    ]);
    const agg = new Map<string, { display_name: string; accepted: number; earned: number }>();
    for (const r of (reps ?? []) as unknown as { researcher_id: string; status: string; researcher_profiles: { display_name: string } | null }[]) {
      const e = agg.get(r.researcher_id) ?? { display_name: r.researcher_profiles?.display_name ?? '—', accepted: 0, earned: 0 };
      if (['accepted', 'resolved', 'closed'].includes(r.status)) e.accepted += 1;
      agg.set(r.researcher_id, e);
    }
    for (const a of (awards ?? []) as unknown as { amount: number; reports: { researcher_id: string } }[]) {
      const e = agg.get(a.reports.researcher_id) ?? { display_name: '—', accepted: 0, earned: 0 };
      e.earned += Number(a.amount);
      agg.set(a.reports.researcher_id, e);
    }
    rows = [...agg.entries()].map(([researcher_id, v], i) => ({
      researcher_id, display_name: v.display_name, score: v.accepted * 10, rank: i + 1, total_earned: v.earned, accepted_reports: v.accepted,
    })).sort((a, b) => {
      if (active === 'earnings') return b.total_earned - a.total_earned;
      if (active === 'accepted') return b.accepted_reports - a.accepted_reports;
      return b.score - a.score;
    }).slice(0, 50);
  }
  const metric = (r: { score: number; total_earned: number; accepted_reports: number }) =>
    active === 'earnings' ? `${r.total_earned} EGP` : active === 'accepted' ? `${r.accepted_reports} تقرير` : `${r.score} نقطة`;

  return (
    <div>
      <PageHero kicker="التنافس الشريف" title="المتصدرين" desc="ترتيب الباحثين — اختر المعيار المناسب." />
      <section className="container max-w-3xl py-10">
        <div className="mb-3 flex gap-2 text-xs">
          {([['all', 'كل الأوقات'], ['year', 'هذه السنة'], ['month', 'هذا الشهر']] as const).map(([k, label]) => (
            <Link key={k} href={`/leaderboard?by=${active}&period=${k}`} className={cn('rounded-full border px-3.5 py-1.5 transition-all duration-200', period === k ? 'border-navy-900 bg-navy-900 font-bold text-white shadow-card dark:border-navy-100 dark:bg-navy-100 dark:text-navy-900' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              {label}
            </Link>
          ))}
        </div>
        <div className="mb-6 flex gap-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/leaderboard?by=${t.key}&period=${period}`}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-bold',
                active === t.key ? 'border-navy-900 bg-navy-900 text-white shadow-card dark:border-navy-100 dark:bg-navy-100 dark:text-navy-900' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          ))}
        </div>
        {!rows.length ? <p className="text-muted-foreground">No researchers yet.</p> : (
          <div className="space-y-2">
            {rows.map((r: { researcher_id: string; display_name: string; score: number; rank: number; total_earned: number; accepted_reports: number }, i: number) => (
              <Card key={r.researcher_id} className={i < 3 ? 'border-amber-400/50 bg-gradient-to-br from-amber-50 to-transparent shadow-gold dark:from-amber-950/30' : ''}>
                <CardContent className="flex items-center gap-4 p-4">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black', i < 3 ? 'bg-amber-400 text-navy-900 shadow-gold' : 'bg-navy text-amber-400')}>
                    {i < 3 ? <Medal className="h-5 w-5" /> : i + 1}
                  </span>
                  <Avatar name={r.display_name} />
                  <span className="flex-1 font-bold">{r.display_name}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-sm font-bold tabular-nums text-foreground">{metric(r)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

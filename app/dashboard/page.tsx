import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EarningsChart } from '@/components/charts/earnings-chart';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user)
    return (
      <main className="container py-12">
        <Link href="/login" className="underline">Login required</Link>
      </main>
    );
  const { data: rp } = await supabase
    .from('researcher_profiles')
    .select('id,display_name')
    .eq('user_id', user.user.id)
    .single();
  if (!rp) return <main className="container py-12">Researcher profile not found.</main>;
  const [{ data: stats }, { data: rep }, { data: wallet }, { data: recent }, { data: txns }] = await Promise.all([
    supabase.from('researcher_stats').select('*').eq('researcher_id', rp.id).single(),
    supabase.from('researcher_reputation').select('score').eq('researcher_id', rp.id).single(),
    supabase.from('wallets').select('balance,pending_balance,total_earned').eq('researcher_id', rp.id).single(),
    supabase.from('reports').select('id,report_number,title,status').eq('researcher_id', rp.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('wallet_transactions').select('amount,created_at,type').order('created_at', { ascending: false }).limit(100),
  ]);
  const byMonth = ((txns ?? []) as { amount: number; created_at: string; type: string }[])
    .filter((t) => t.type === 'bounty' && t.amount > 0)
    .reduce<Record<string, number>>((a, t) => {
      const m = new Date(t.created_at).toISOString().slice(0, 7);
      return { ...a, [m]: (a[m] ?? 0) + Number(t.amount) };
    }, {});
  const earnings = Object.entries(byMonth).sort().map(([month, total]) => ({ month, total }));

  const cards = [
    { label: 'Total reports', value: stats?.total_reports ?? 0, href: '/dashboard/reports' },
    { label: 'Accepted', value: stats?.accepted_reports ?? 0, href: '/dashboard/reports' },
    { label: 'Resolved', value: stats?.resolved_reports ?? 0, href: '/dashboard/reports' },
    { label: 'Reputation', value: rep?.score ?? 0, href: '/leaderboard' },
    { label: 'Balance', value: `${wallet?.balance ?? 0} EGP`, href: '/dashboard/wallet' },
  ];

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-1">مرحباً {rp.display_name}</h1>
      <p className="text-muted-foreground mb-6">Researcher dashboard</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{c.value}</p>
              <Link href={c.href} className="text-xs underline">View</Link>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-8"><CardHeader><CardTitle className="text-sm">Earnings over time</CardTitle></CardHeader><CardContent><EarningsChart data={earnings} /></CardContent></Card>
      <h2 className="text-lg font-semibold mt-8 mb-3">Recent reports</h2>
      {!recent?.length ? (
        <p className="text-muted-foreground">No reports yet.</p>
      ) : (
        <div className="space-y-2">
          {recent.map((r) => (
            <Link key={r.id} href={`/dashboard/reports/${r.id}`} className="block border rounded-md p-3 hover:bg-accent">
              {r.report_number} — {r.title} ({r.status})
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

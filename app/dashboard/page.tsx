import Link from 'next/link';
import { FileText, CheckCircle2, BadgeCheck, Star, Wallet, ArrowLeft } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/shared/status-pill';
import { EarningsChart } from '@/components/charts/earnings-chart';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return (
      <div className="py-2 text-sm">
        سجّل الدخول أولًا من <Link href="/login" className="underline">هنا</Link>.
      </div>
    );
  }
  const { data: rp } = await supabase
    .from('researcher_profiles')
    .select('id,display_name')
    .eq('user_id', user.user.id)
    .single();
  if (!rp) return <div className="py-2 text-sm text-muted-foreground">لا يوجد ملف باحث مرتبط بحسابك.</div>;
  const [{ data: stats }, { data: rep }, { data: wallet }, { data: recent }, { data: txns }] = await Promise.all([
    supabase.from('researcher_stats').select('*').eq('researcher_id', rp.id).single(),
    supabase.from('researcher_reputation').select('score').eq('researcher_id', rp.id).single(),
    supabase.from('wallets').select('balance,pending_balance,total_earned').eq('researcher_id', rp.id).single(),
    supabase.from('reports').select('id,report_number,title,status,severity').eq('researcher_id', rp.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('wallet_transactions').select('amount,created_at,type').order('created_at', { ascending: false }).limit(100),
  ]);
  const byMonth = ((txns ?? []) as { amount: number; created_at: string; type: string }[])
    .filter((t) => t.type === 'bounty' && t.amount > 0)
    .reduce<Record<string, number>>((a, t) => {
      const m = new Date(t.created_at).toISOString().slice(0, 7);
      return { ...a, [m]: (a[m] ?? 0) + Number(t.amount) };
    }, {});
  const earnings = Object.entries(byMonth).sort().map(([month, total]) => ({ month, total }));

  const total = stats?.total_reports ?? 0;
  const accepted = stats?.accepted_reports ?? 0;
  const acceptance = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const cards = [
    { label: 'Total reports', value: total, href: '/dashboard/reports', icon: FileText },
    { label: 'Accepted', value: accepted, href: '/dashboard/reports', icon: CheckCircle2 },
    { label: 'Acceptance rate', value: `${acceptance}%`, href: '/dashboard/reports', icon: BadgeCheck },
    { label: 'Resolved', value: stats?.resolved_reports ?? 0, href: '/dashboard/reports', icon: CheckCircle2 },
    { label: 'Reputation', value: rep?.score ?? 0, href: '/leaderboard', icon: Star },
    { label: 'Balance', value: `${wallet?.balance ?? 0} EGP`, href: '/dashboard/wallet', icon: Wallet },
  ];

  return (
    <div className="py-2">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">مرحبًا، {rp.display_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">نظرة عامة على نشاطك ومستحقاتك</p>
        </div>
        <Link href="/dashboard/reports/new">
          <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-700">تقرير جديد</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums">{c.value}</p>
              <Link href={c.href} className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                عرض <ArrowLeft className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">الأرباح عبر الأشهر</CardTitle></CardHeader>
          <CardContent><EarningsChart data={earnings} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">أحدث التقارير</CardTitle>
            <Link href="/dashboard/reports" className="text-xs text-muted-foreground hover:text-foreground">الكل</Link>
          </CardHeader>
          <CardContent>
            {!recent?.length ? (
              <p className="text-sm text-muted-foreground">لا توجد تقارير بعد.</p>
            ) : (
              <ul className="divide-y">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/dashboard/reports/${r.id}`} className="block truncate text-sm font-medium hover:underline">
                        {r.title}
                      </Link>
                      <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">{r.report_number}</p>
                    </div>
                    <StatusPill value={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

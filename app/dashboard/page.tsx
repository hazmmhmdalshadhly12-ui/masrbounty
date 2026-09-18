import Link from 'next/link';
import { FileText, CheckCircle2, BadgeCheck, Star, Wallet, ArrowLeft, Trophy, Award, TrendingUp } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/shared/status-pill';
import { EarningsChart } from '@/components/charts/earnings-chart';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return (
      <div className="py-6 text-sm" dir="rtl">
        سجّل الدخول أولًا من <Link href="/login" className="underline">هنا</Link>.
      </div>
    );
  }
  const { data: rp } = await supabase
    .from('researcher_profiles')
    .select('id,display_name')
    .eq('user_id', user.user.id)
    .single();
  if (!rp) return <div className="py-6 text-sm text-muted-foreground" dir="rtl">لا يوجد ملف باحث مرتبط بحسابك. أنشئ ملفك من الإعدادات.</div>;

  const researcherId = (rp as { id: string; display_name: string }).id;

  const [
    { data: stats },
    { data: rep },
    { data: wallet },
    { data: recent },
    { data: walletRow },
    { data: txnsRaw },
    { data: awardsRaw },
    { data: badgesRaw },
    { data: leaderboardTop },
    { data: myRankRow },
  ] = await Promise.all([
    supabase.from('researcher_stats').select('*').eq('researcher_id', researcherId).single(),
    supabase.from('researcher_reputation').select('score').eq('researcher_id', researcherId).single(),
    supabase.from('wallets').select('balance,pending_balance,total_earned').eq('researcher_id', researcherId).single(),
    supabase.from('reports').select('id,report_number,title,status,severity,created_at').eq('researcher_id', researcherId).order('created_at', { ascending: false }).limit(5),
    supabase.from('wallets').select('id').eq('researcher_id', researcherId).maybeSingle(),
    // wallet_transactions via wallet_id; fetch if we have wallet id else empty
    (async () => {
      // we need wallet id first; fetch via separate query fallback
      const { data: w } = await supabase.from('wallets').select('id').eq('researcher_id', researcherId).maybeSingle();
      const wid = (w as { id: string } | null)?.id;
      if (!wid) return { data: [] as unknown[] };
      const { data } = await supabase.from('wallet_transactions').select('amount,created_at,type').eq('wallet_id', wid).order('created_at', { ascending: false }).limit(100);
      return { data: data ?? [] };
    })(),
    supabase.from('bounty_awards').select('amount,created_at,status,report_id').limit(200).then(async (res) => {
      // filter to only my reports
      const { data: myReports } = await supabase.from('reports').select('id').eq('researcher_id', researcherId).limit(200);
      const myIds = new Set(((myReports ?? []) as { id: string }[]).map((r) => r.id));
      const filtered = ((res.data ?? []) as { amount: number | string; created_at: string; status: string; report_id: string }[]).filter((a) => myIds.has(a.report_id) && (a.status === 'paid' || a.status === 'approved'));
      return { data: filtered };
    }),
    supabase.from('researcher_badges').select('id,awarded_at,badges(id,code,name_ar,name_en,icon)').eq('researcher_id', researcherId).order('awarded_at', { ascending: false }).limit(20),
    supabase.from('researcher_leaderboard').select('researcher_id,display_name,score,rank,total_earned').order('score', { ascending: false }).limit(5),
    supabase.from('researcher_leaderboard').select('researcher_id,display_name,score,rank').eq('researcher_id', researcherId).maybeSingle(),
  ]);

  // earnings: prefer wallet_transactions bounty/award, fallback to bounty_awards
  const txns = (txnsRaw as unknown as { amount: number | string; created_at: string; type: string }[] | null) ?? [];
  const awards = (awardsRaw as unknown as { amount: number | string; created_at: string; status: string }[] | null) ?? [];

  const earningsSource: { amount: number; created_at: string }[] =
    txns.filter((t) => t.type === 'bounty' || t.type === 'award' || Number(t.amount) > 0).length > 0
      ? txns.filter((t) => Number(t.amount) > 0 && t.type !== 'payout').map((t) => ({ amount: Number(t.amount), created_at: t.created_at }))
      : awards.map((a) => ({ amount: Number(a.amount), created_at: a.created_at }));

  const byMonth = earningsSource.reduce<Record<string, number>>((a, t) => {
    const m = new Date(t.created_at).toISOString().slice(0, 7);
    return { ...a, [m]: (a[m] ?? 0) + Number(t.amount) };
  }, {});
  const earnings = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));

  const total = (stats as { total_reports?: number } | null)?.total_reports ?? 0;
  const accepted = (stats as { accepted_reports?: number } | null)?.accepted_reports ?? 0;
  const submitted = total; // total_reports is submitted+others; keep separate if needed via query but use total for now; pending shows draft not counted
  const acceptance = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const totalEarned = Number((wallet as { total_earned?: number | string } | null)?.total_earned ?? (stats as { total_earned?: number | string } | null)?.total_earned ?? 0);
  const reputationScore = Number((rep as { score?: number } | null)?.score ?? 0);
  const reputationRank = (myRankRow as { rank?: number } | null)?.rank ?? null;

  const badges = ((badgesRaw ?? []) as unknown) as { id: string; awarded_at: string; badges: { id: string; code: string; name_ar: string; name_en: string; icon: string | null } | null }[];
  const lbTop = (leaderboardTop ?? []) as { researcher_id: string; display_name: string; score: number; rank: number; total_earned: number | string }[];

  // stat cards spec requested: submitted, accepted, total earned, reputation rank
  const kpi = [
    { label: 'التقارير المقدّمة', value: submitted, sub: `${acceptance}% قبول`, href: '/dashboard/reports', icon: FileText },
    { label: 'التقارير المقبولة', value: accepted, sub: `من أصل ${total}`, href: '/dashboard/reports', icon: CheckCircle2 },
    { label: 'إجمالي الأرباح', value: `${totalEarned.toLocaleString('ar-EG')} EGP`, sub: `الرصيد ${Number((wallet as { balance?: number | string } | null)?.balance ?? 0).toLocaleString('ar-EG')} EGP`, href: '/dashboard/wallet', icon: Wallet },
    { label: 'السمعة — الترتيب', value: reputationRank ? `#${reputationRank}` : `${reputationScore} نقطة`, sub: `${reputationScore} نقطة سمعة`, href: '/leaderboard', icon: Trophy },
  ];

  void walletRow; // keep for typecheck side-effect if needed

  return (
    <div className="py-2" dir="rtl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">مرحبًا، {(rp as { display_name: string }).display_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">نظرة عامة على نشاطك ومستحقاتك — بيانات حية</p>
        </div>
        <Link href="/dashboard/reports/new">
          <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900">تقرير جديد</Button>
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpi.map((c) => (
          <Card key={c.label} className="dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <c.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums tracking-tight">{c.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
              <Link href={c.href} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                عرض <ArrowLeft className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* secondary stats row (keep acceptance + reputation details) */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="dark:border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> معدل القبول</p>
            <p className="mt-2 text-xl font-black tabular-nums">{acceptance}%</p>
          </CardContent>
        </Card>
        <Card className="dark:border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> المحلولة</p>
            <p className="mt-2 text-xl font-black tabular-nums">{(stats as { resolved_reports?: number } | null)?.resolved_reports ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="dark:border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3.5 w-3.5" /> نقاط السمعة</p>
            <p className="mt-2 text-xl font-black tabular-nums">{reputationScore}</p>
          </CardContent>
        </Card>
        <Card className="dark:border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> الرصيد المعلق</p>
            <p className="mt-2 text-xl font-black tabular-nums" dir="ltr">{Number((wallet as { pending_balance?: number | string } | null)?.pending_balance ?? 0).toLocaleString('ar-EG')} EGP</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> الأرباح عبر الأشهر</CardTitle>
            <CardDescription>مجموع المكافآت المدفوعة/المعتمدة شهريًا — Area chart</CardDescription>
          </CardHeader>
          <CardContent>
            <EarningsChart data={earnings} />
          </CardContent>
        </Card>
        <Card className="dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">أحدث التقارير</CardTitle>
            <Link href="/dashboard/reports" className="text-xs text-muted-foreground hover:text-foreground">الكل</Link>
          </CardHeader>
          <CardContent>
            {!recent?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">لا توجد تقارير بعد.</p>
            ) : (
              <ul className="divide-y dark:divide-slate-800">
                {(recent as { id: string; report_number: string; title: string; status: string; severity: string }[]).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/dashboard/reports/${r.id}`} className="block truncate text-sm font-medium hover:underline">
                        {r.title}
                      </Link>
                      <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">{r.report_number} · <span className="capitalize">{r.severity}</span></p>
                    </div>
                    <StatusPill value={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4" /> الشارات</CardTitle>
            <CardDescription>شاراتك المكتسبة — {badges.length} شارة</CardDescription>
          </CardHeader>
          <CardContent>
            {!badges.length ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">لم تحصل على شارات بعد — أكمل تقارير مقبولة لفتح الشارات</p>
                <Link href="/dashboard/badges" className="mt-2 inline-block text-xs underline">استعرض كتالوج الشارات</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {badges.map((b) => (
                  <div key={b.id} className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center dark:border-slate-700">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/20 text-lg">{b.badges?.icon ?? '🏅'}</span>
                    <span className="text-xs font-bold leading-tight">{b.badges?.name_ar ?? b.badges?.name_en ?? b.badges?.code ?? 'شارة'}</span>
                    <span className="text-[11px] text-muted-foreground">{new Date(b.awarded_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> المتصدرون</CardTitle>
              <CardDescription>أعلى 5 باحثين — موقعك {reputationRank ? `#${reputationRank}` : 'غير مصنف'}</CardDescription>
            </div>
            <Link href="/leaderboard" className="text-xs text-muted-foreground hover:text-foreground">اللوحة الكاملة</Link>
          </CardHeader>
          <CardContent>
            {!lbTop.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">لا توجد بيانات لوحة المتصدرين بعد</p>
            ) : (
              <div className="overflow-hidden rounded-lg border dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr className="text-right">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">الباحث</th>
                      <th className="px-3 py-2 font-medium">النقاط</th>
                      <th className="px-3 py-2 font-medium">الأرباح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lbTop.map((e) => {
                      const isMe = e.researcher_id === researcherId;
                      return (
                        <tr key={e.researcher_id} className={`border-t dark:border-slate-800 ${isMe ? 'bg-amber-50 dark:bg-amber-950/30 font-bold' : 'hover:bg-muted/40'}`}>
                          <td className="px-3 py-2 tabular-nums">#{e.rank}</td>
                          <td className="px-3 py-2" dir="ltr">{e.display_name} {isMe && <Badge variant="secondary" className="mr-1 text-[10px]">أنت</Badge>}</td>
                          <td className="px-3 py-2 tabular-nums">{Number(e.score).toLocaleString('ar-EG')}</td>
                          <td className="px-3 py-2 tabular-nums" dir="ltr">{Number(e.total_earned).toLocaleString('ar-EG')} EGP</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {reputationRank && reputationRank > 5 && (
              <p className="mt-3 text-xs text-muted-foreground">ترتيبك الحالي <span className="font-black">#{reputationRank}</span> — واصل الإنجاز للتقدم!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

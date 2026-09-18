import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Trophy, Award, ShieldCheck, Globe, Github, Twitter, Linkedin, Medal, Star, Clock } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/shared/avatar';
import { timeAgo, formatDate } from '@/utils/time';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ username: string }> };

export default async function ResearcherPublicPage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createServerClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,username,full_name,avatar_url,bio,created_at')
    .eq('username', username)
    .single();

  if (!profile) return notFound();

  const { data: rp } = await supabase
    .from('researcher_profiles')
    .select('id,display_name,country,website,github,twitter,linkedin,skills,is_public,user_id,created_at')
    .eq('user_id', profile.id)
    .single();

  // Privacy gate: only public fields are ever shown. Respect is_public strictly.
  if (!rp || !rp.is_public) {
    return (
      <main dir="rtl" lang="ar" className="container max-w-2xl py-12">
        <Card className="text-center">
          <CardContent className="p-10">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-black">الملف خاص</h1>
            <p className="mt-2 text-sm text-muted-foreground">هذا الباحث اختار إخفاء ملفه العام. لا توجد بيانات عامة للعرض.</p>
            <Link href="/researchers" className="mt-6 inline-block text-sm underline">
              العودة للباحثين
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const [{ data: stats }, { data: rep }, { data: leaderboardRow }, { data: badges }, { data: verifs }, { data: hof }, trustRes] =
    await Promise.all([
      supabase.from('researcher_stats').select('*').eq('researcher_id', rp.id).single(),
      supabase.from('researcher_reputation').select('score,rank').eq('researcher_id', rp.id).single(),
      supabase.from('researcher_leaderboard').select('researcher_id,display_name,score,rank,accepted_reports,resolved_reports,total_earned').eq('researcher_id', rp.id).single(),
      supabase
        .from('researcher_badges')
        .select('badge_id,awarded_at,badges(code,name_ar,name_en,icon)')
        .eq('researcher_id', rp.id),
      supabase.from('researcher_verifications').select('kind,status').eq('researcher_id', rp.id),
      supabase
        .from('hall_of_fame')
        .select('id,achievement,display_name,recognized_at,company_id,company_profiles(name,slug)')
        .eq('researcher_id', rp.id)
        .order('recognized_at', { ascending: false })
        .limit(10),
      supabase.rpc('researcher_trust', { p_researcher: rp.id }),
    ]);

  const trustRow = (
    Array.isArray((trustRes as { data: unknown }).data) ? (trustRes as { data: { score: number; factors: Record<string, unknown> }[] }).data[0] : null
  ) as { score: number; factors: Record<string, unknown> } | null;

  const vmap = Object.fromEntries((verifs ?? []).map((v: { kind: string; status: string }) => [v.kind, v.status])) as Record<
    string,
    string
  >;

  const rank = leaderboardRow?.rank ?? rep?.rank ?? null;
  const score = leaderboardRow?.score ?? rep?.score ?? 0;

  const levelLabel =
    vmap.identity === 'verified'
      ? 'باحث جدير بالثقة'
      : vmap.phone === 'verified'
        ? 'هوية متقدمة'
        : vmap.email === 'verified'
          ? 'بريد موثق'
          : 'غير موثق';

  // Only public fields: display_name, avatar, country, website/github/twitter/linkedin, skills, bio, rank, stats, badges, hof
  return (
    <main dir="rtl" lang="ar" className="container max-w-4xl py-8">
      {/* Header */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900" aria-hidden />
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <Avatar name={rp.display_name} src={profile.avatar_url} size="lg" className="h-20 w-20 border-4 border-white shadow-lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">{rp.display_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                @{profile.username} {rp.country ? `• ${rp.country}` : ''} • عضو منذ {formatDate(profile.created_at)}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="default" className="gap-1">
                  <Trophy className="h-3 w-3" /> {score} نقطة
                </Badge>
                {rank != null && (
                  <Badge variant="secondary" className="gap-1">
                    <Medal className="h-3 w-3" /> المركز #{rank}
                  </Badge>
                )}
                <Badge variant="outline">{levelLabel}</Badge>
                {trustRow && <Badge variant="outline">ثقة {trustRow.score}/100</Badge>}
                {vmap.email === 'verified' && <Badge variant="secondary">بريد موثق ✓</Badge>}
                {vmap.phone === 'verified' && <Badge variant="secondary">هاتف موثق ✓</Badge>}
                {vmap.identity === 'verified' && <Badge className="bg-emerald-600 hover:bg-emerald-700">هوية موثقة ✓</Badge>}
              </div>

              {profile.bio && <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed">{profile.bio}</p>}

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {rp.website && (
                  <a href={rp.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    <Globe className="h-3 w-3" /> موقع
                  </a>
                )}
                {rp.github && (
                  <a href={`https://github.com/${rp.github}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    <Github className="h-3 w-3" /> {rp.github}
                  </a>
                )}
                {rp.twitter && (
                  <a href={`https://twitter.com/${rp.twitter.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    <Twitter className="h-3 w-3" /> {rp.twitter}
                  </a>
                )}
                {rp.linkedin && (
                  <a href={rp.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    <Linkedin className="h-3 w-3" /> LinkedIn
                  </a>
                )}
              </div>

              {!!(rp.skills ?? []).length && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(rp.skills ?? []).slice(0, 12).map((s: string) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 md:items-end">
              <Link href="/leaderboard" className="text-xs underline text-muted-foreground hover:text-foreground">
                عرض المتصدرين
              </Link>
              <Link href="/hall-of-fame" className="text-xs underline text-muted-foreground hover:text-foreground">
                قاعة المشاهير
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-amber-500" /> السمعة والترتيب
            </CardTitle>
            <CardDescription>من researcher_leaderboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">النقاط</span> <b className="tabular-nums">{score}</b>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">الترتيب</span> <b>{rank != null ? `#${rank}` : '—'}</b>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">المقبولة</span> <b>{leaderboardRow?.accepted_reports ?? stats?.accepted_reports ?? 0}</b>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">المحلولة</span> <b>{leaderboardRow?.resolved_reports ?? stats?.resolved_reports ?? 0}</b>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">الإحصائيات</CardTitle>
            <CardDescription>تقارير ومكافآت</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-black tabular-nums">{stats?.total_reports ?? 0}</p>
              <p className="text-xs text-muted-foreground">إجمالي التقارير</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-black tabular-nums">{stats?.accepted_reports ?? 0}</p>
              <p className="text-xs text-muted-foreground">مقبولة</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-black tabular-nums">{stats?.resolved_reports ?? 0}</p>
              <p className="text-xs text-muted-foreground">محلولة</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-black tabular-nums" dir="ltr">
                {(Number(leaderboardRow?.total_earned ?? stats?.total_earned ?? 0)).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">EGP مكتسبة</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 text-violet-500" /> الأوسمة
            </CardTitle>
            <CardDescription>{(badges ?? []).length ? `${(badges ?? []).length} وسام` : 'لا أوسمة بعد'}</CardDescription>
          </CardHeader>
          <CardContent>
            {!(badges ?? []).length ? (
              <p className="text-sm text-muted-foreground">سيظهر هنا كل وسام يمنحه النظام تلقائيًا عند الإنجازات.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(badges as unknown as { badge_id: string; badges: { code: string; name_ar: string; name_en: string } | null }[]).map(
                  (b) => (
                    <Badge key={b.badge_id} variant="secondary" className="gap-1">
                      <Award className="h-3 w-3" /> {b.badges?.name_ar ?? b.badges?.name_en ?? b.badge_id}
                    </Badge>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hall of fame entries */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> تكريمات قاعة المشاهير
          </CardTitle>
          <CardDescription>تكريمات علنية اختارتها الشركات لهذا الباحث (بموافقته).</CardDescription>
        </CardHeader>
        <CardContent>
          {!(hof ?? []).length ? (
            <p className="text-sm text-muted-foreground">لا توجد تكريمات منشورة لهذا الباحث بعد.</p>
          ) : (
            <div className="space-y-3">
              {(hof as unknown as { id: string; achievement: string; recognized_at: string; company_profiles: { name: string; slug: string } | null }[]).map(
                (h) => (
                  <div key={h.id} className="flex gap-3 rounded-lg border p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <Trophy className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-relaxed">{h.achievement}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {h.company_profiles?.name && <Badge variant="outline">{h.company_profiles.name}</Badge>}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {timeAgo(h.recognized_at)}
                        </span>
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        تُعرض فقط الحقول العامة لهذا الباحث احترامًا لإعدادات الخصوصية. الترتيب مأخوذ من <code dir="ltr">researcher_leaderboard</code>.
      </p>
    </main>
  );
}

import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function ResearcherPublic({ params }: { params: Promise<{ username: string }> }) {
  const supabase = await createServerClient();
  const { username } = await params;
  const { data: profile } = await supabase.from('profiles').select('id,username,full_name,avatar_url,bio,created_at').eq('username', username).single();
  if (!profile) return <main className="container py-12">Researcher not found.</main>;
  const { data: rp } = await supabase.from('researcher_profiles').select('id,display_name,skills,is_public').eq('user_id', profile.id).single();
  if (!rp || !rp.is_public) return <main className="container py-12">Profile is private.</main>;
  const [{ data: stats }, { data: rep }, { data: badges }, { data: verifs }, { data: hof }, trust] = await Promise.all([
    supabase.from('researcher_stats').select('*').eq('researcher_id', rp.id).single(),
    supabase.from('researcher_reputation').select('score').eq('researcher_id', rp.id).single(),
    supabase.from('researcher_badges').select('badge_id,badges(code,name_en)').eq('researcher_id', rp.id),
    supabase.from('researcher_verifications').select('kind,status').eq('researcher_id', rp.id),
    supabase.from('hall_of_fame').select('achievement,created_at').eq('researcher_id', rp.id).order('recognized_at', { ascending: false }).limit(5),
    supabase.rpc('researcher_trust', { p_researcher: rp.id }),
  ]);
  const trustRow = (Array.isArray(trust.data) ? trust.data[0] : null) as { score: number; factors: Record<string, number> } | null;
  const vmap = Object.fromEntries((verifs ?? []).map((v: { kind: string; status: string }) => [v.kind, v.status]));
  const level = vmap.identity === 'verified' ? 'باحث جدير بالثقة' : vmap.phone === 'verified' ? 'هوية قيد المراجعة المتقدمة' : vmap.email === 'verified' ? 'بريد موثق' : 'غير موثق';
  return (
    <main className="container py-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{rp.display_name}</h1>
        <p className="text-muted-foreground">@{profile.username} • {rep?.score ?? 0} pts</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {vmap.email === 'verified' && <Badge>بريد موثق ✓</Badge>}
          {vmap.phone === 'verified' && <Badge>هاتف موثق ✓</Badge>}
          {vmap.identity === 'verified' && <Badge>هوية موثقة ✓</Badge>}
          <Badge variant="secondary">{level}</Badge>
          {trustRow && <Badge variant="outline">ثقة {trustRow.score}/100</Badge>}
        </div>
        {profile.bio && <p className="mt-3">{profile.bio}</p>}
        <p className="mt-1 text-xs text-muted-foreground">عضو منذ {new Date(profile.created_at).toLocaleDateString('ar-EG')}</p>
      </div>
      <Card><CardHeader><CardTitle>Stats</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2 text-sm">
        <p>Reports: {stats?.total_reports ?? 0}</p><p>Accepted: {stats?.accepted_reports ?? 0}</p>
        <p>Resolved: {stats?.resolved_reports ?? 0}</p><p>Earned: {stats?.total_earned ?? 0}</p>
      </CardContent></Card>
      {!!badges?.length && <Card><CardHeader><CardTitle>Badges</CardTitle></CardHeader><CardContent className="flex gap-2 flex-wrap">{(badges as unknown as { badge_id: string; badges: { code: string; name_en: string } | null }[]).map((b) => <Badge key={b.badge_id}>{b.badges?.name_en ?? b.badge_id}</Badge>)}</CardContent></Card>}
      {!!hof?.length && (
        <Card><CardHeader><CardTitle>تكريمات قاعة المشاهير</CardTitle></CardHeader><CardContent>
          {hof.map((h: { achievement: string; created_at: string }, i: number) => (
            <p key={i} className="border-b py-2 text-sm last:border-0">{h.achievement} <span className="text-muted-foreground">— {new Date(h.created_at).toLocaleDateString('ar-EG')}</span></p>
          ))}
        </CardContent></Card>
      )}
    </main>
  );
}

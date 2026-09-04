import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function ResearcherPublic({ params }: { params: Promise<{ username: string }> }) {
  const supabase = await createServerClient();
  const { username } = await params;
  const { data: profile } = await supabase.from('profiles').select('id,username,full_name,avatar_url,bio').eq('username', username).single();
  if (!profile) return <main className="container py-12">Researcher not found.</main>;
  const { data: rp } = await supabase.from('researcher_profiles').select('id,display_name,skills,is_public').eq('user_id', profile.id).single();
  if (!rp || !rp.is_public) return <main className="container py-12">Profile is private.</main>;
  const [{ data: stats }, { data: rep }, { data: badges }] = await Promise.all([
    supabase.from('researcher_stats').select('*').eq('researcher_id', rp.id).single(),
    supabase.from('researcher_reputation').select('score').eq('researcher_id', rp.id).single(),
    supabase.from('researcher_badges').select('badge_id,badges(code,name_en)').eq('researcher_id', rp.id),
  ]);
  return (
    <main className="container py-8 max-w-2xl space-y-6">
      <div><h1 className="text-3xl font-bold">{rp.display_name}</h1><p className="text-muted-foreground">@{profile.username} • {rep?.score ?? 0} pts</p>{profile.bio && <p className="mt-2">{profile.bio}</p>}</div>
      <Card><CardHeader><CardTitle>Stats</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2 text-sm">
        <p>Reports: {stats?.total_reports ?? 0}</p><p>Accepted: {stats?.accepted_reports ?? 0}</p>
        <p>Resolved: {stats?.resolved_reports ?? 0}</p><p>Earned: {stats?.total_earned ?? 0}</p>
      </CardContent></Card>
      {!!badges?.length && <Card><CardHeader><CardTitle>Badges</CardTitle></CardHeader><CardContent className="flex gap-2 flex-wrap">{(badges as unknown as { badge_id: string; badges: { code: string; name_en: string } | null }[]).map((b) => <Badge key={b.badge_id}>{b.badges?.name_en ?? b.badge_id}</Badge>)}</CardContent></Card>}
    </main>
  );
}

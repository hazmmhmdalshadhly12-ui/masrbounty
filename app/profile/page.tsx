import Link from 'next/link';
import { requireSession } from '@/lib/auth/guard';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function ProfilePage() {
  const session = await requireSession({ next: '/profile' });
  const supabase = await createServerClient();
  const [{ data: profile }, { data: roles }, { data: rp }] = await Promise.all([
    supabase.from('profiles').select('username,full_name,avatar_url,bio,locale,created_at').eq('id', session.id).single(),
    supabase.from('user_roles').select('role').eq('user_id', session.id),
    supabase.from('researcher_profiles').select('id,display_name').eq('user_id', session.id).maybeSingle(),
  ]);
  const [{ data: rep }, { data: stats }, { data: badges }, { data: verifs }] = await Promise.all([
    rp ? supabase.from('researcher_reputation').select('score').eq('researcher_id', rp.id).single() : Promise.resolve({ data: null }),
    rp ? supabase.from('researcher_stats').select('total_reports,accepted_reports,resolved_reports,total_earned').eq('researcher_id', rp.id).single() : Promise.resolve({ data: null }),
    rp ? supabase.from('researcher_badges').select('badge_id,badges(name_en)').eq('researcher_id', rp.id) : Promise.resolve({ data: [] }),
    rp ? supabase.from('researcher_verifications').select('kind,status').eq('researcher_id', rp.id) : Promise.resolve({ data: [] }),
  ]);

  return (
    <main className="container max-w-2xl py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{profile?.full_name || rp?.display_name || profile?.username}</h1>
          <p className="mt-1 text-sm text-muted-foreground" dir="ltr">@{profile?.username} • {session.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(roles ?? []).map((r: { role: string }) => <Badge key={r.role} variant="secondary">{r.role}</Badge>)}
            {(verifs ?? []).map((v: { kind: string; status: string }) =>
              v.status === 'verified' ? <Badge key={v.kind}>{v.kind} ✓</Badge> : null
            )}
          </div>
          {profile?.bio && <p className="mt-3 text-sm leading-relaxed">{profile.bio}</p>}
        </div>
        <div className="flex gap-2">
          {rp && <Link href={`/researchers/${profile?.username}`}><Button size="sm" variant="outline">العرض العام</Button></Link>}
          <Link href="/dashboard/settings"><Button size="sm">تعديل</Button></Link>
        </div>
      </div>

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['التقارير', stats.total_reports ?? 0],
            ['المقبولة', stats.accepted_reports ?? 0],
            ['المحلولة', stats.resolved_reports ?? 0],
            ['السمعة', rep?.score ?? 0],
          ].map(([label, v]) => (
            <Card key={label as string}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-black tabular-nums">{v}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!!(badges ?? []).length && (
        <Card className="mt-4">
          <CardHeader><CardTitle>الشارات</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(badges as unknown as { badge_id: string; badges: { name_en: string } | null }[]).map((b) => (
              <Badge key={b.badge_id}>{b.badges?.name_en}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="mt-6 text-xs text-muted-foreground">عضو منذ {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ar-EG') : '—'}</p>
    </main>
  );
}

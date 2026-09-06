import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function SavedPrograms() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) return <main className="container py-12">No profile.</main>;
  const [{ data: saved }, { data: invites }] = await Promise.all([
    supabase.from('saved_programs').select('program_id,programs(id,name,slug)').eq('researcher_id', rp.id),
    supabase.from('program_researchers').select('program_id,programs!inner(id,name,slug,status)').eq('researcher_id', rp.id).eq('programs.status', 'active'),
  ]);
  const invited = ((invites ?? []) as unknown as { program_id: string; programs: { name: string; slug: string } }[]).filter((i) => i.programs);
  return (
    <main className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">برامجي</h1>
      <h2 className="mb-3 font-bold">دعوات خاصة ({invited.length})</h2>
      {!invited.length ? <p className="mb-6 text-sm text-muted-foreground">لا توجد دعوات — البرامج الخاصة لا تظهر إلا للمدعوين.</p> :
        invited.map((s) => (
          <Card key={s.program_id} className="mb-2 border-amber-400/50">
            <CardHeader><CardTitle className="flex items-center justify-between">
              <Link href={`/programs/${s.programs.slug}`} className="hover:underline">{s.programs.name}</Link>
              <Badge>خاص — بدعوة</Badge>
            </CardTitle></CardHeader>
          </Card>
        ))}
      <h2 className="mb-3 mt-6 font-bold">المحفوظة</h2>
      {!saved?.length ? <p className="text-muted-foreground">No saved programs. <Link href="/programs" className="underline">Browse</Link></p> :
        ((saved ?? []) as unknown as { program_id: string; programs: { name: string; slug: string } | null }[]).map((s) => (
          <Card key={s.program_id} className="mb-2"><CardHeader><CardTitle><Link href={`/programs/${s.programs?.slug}`} className="hover:underline">{s.programs?.name}</Link></CardTitle></CardHeader>
            <CardContent><Link href="/programs" className="text-xs underline">Browse more</Link></CardContent></Card>
        ))}
    </main>
  );
}

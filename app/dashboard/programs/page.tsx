import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SavedPrograms() {
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) return <main className="container py-12">No profile.</main>;
  const { data: saved } = await supabase.from('saved_programs').select('program_id,programs(id,name,slug)').eq('researcher_id', rp.id);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">برامجي المحفوظة</h1>
      {!saved?.length ? <p className="text-muted-foreground">No saved programs. <Link href="/programs" className="underline">Browse</Link></p> :
        ((saved ?? []) as unknown as { program_id: string; programs: { name: string; slug: string } | null }[]).map((s) => (
          <Card key={s.program_id} className="mb-2"><CardHeader><CardTitle><Link href={`/programs/${s.programs?.slug}`} className="hover:underline">{s.programs?.name}</Link></CardTitle></CardHeader>
            <CardContent><Link href="/programs" className="text-xs underline">Browse more</Link></CardContent></Card>
        ))}
    </main>
  );
}

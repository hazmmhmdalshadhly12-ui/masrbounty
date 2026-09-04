import { createServerClient } from '@/lib/supabase/server';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (((await searchParams).q) ?? '').trim();
  const supabase = await createServerClient();
  let programs: { id: string; name: string; slug: string }[] = [];
  if (q) {
    const { data } = await supabase.from('programs').select('id,name,slug').ilike('name', `%${q}%`).eq('status', 'active').limit(20);
    programs = data ?? [];
  }
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-4">بحث</h1>
      <form className="flex gap-2 mb-6"><Input name="q" defaultValue={q} placeholder="Search programs…" /><Button type="submit">Search</Button></form>
      {q && !programs.length && <p className="text-muted-foreground">No results for “{q}”.</p>}
      {programs.map((p) => <Link key={p.id} href={`/programs/${p.slug}`} className="block border rounded p-3 mb-2">{p.name}</Link>)}
    </main>
  );
}

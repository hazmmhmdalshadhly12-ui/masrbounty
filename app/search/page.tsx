import Link from 'next/link';
import { Search as SearchIcon } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';
import { escapeLike } from '@/utils/search';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (((await searchParams).q) ?? '').trim();
  const supabase = await createServerClient();
  let programs: { id: string; name: string; slug: string }[] = [];
  if (q) {
    const { data } = await supabase.from('programs').select('id,name,slug').ilike('name', `%${escapeLike(q)}%`).eq('status', 'active').eq('visibility', 'public').limit(20);
    programs = data ?? [];
  }
  return (
    <main>
      <PageHero kicker="دوّر بسرعة" title="البحث" desc="ابحث في البرامج النشطة بالاسم." />
      <section className="container max-w-2xl py-10">
        <form className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="اسم البرنامج…" className="pr-9" />
          </div>
          <Button type="submit" className="bg-[#0a1628] text-white hover:bg-[#16294a]">بحث</Button>
        </form>
        <div className="mt-6">
          {q && !programs.length && <p className="text-muted-foreground">No results for “{q}”.</p>}
          {programs.map((p) => (
            <Link key={p.id} href={`/programs/${p.slug}`}>
              <Card className="mb-2 transition-shadow hover:shadow-md">
                <CardContent className="p-4 font-bold">{p.name}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

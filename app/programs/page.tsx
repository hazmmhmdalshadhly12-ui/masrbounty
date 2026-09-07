import Link from 'next/link';
import { AppWindow, ArrowLeft, ShieldCheck } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgramSearch } from '@/components/programs/program-search';
import { escapeLike } from '@/utils/search';

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { q = '', sort = 'new' } = await searchParams;
  const supabase = await createServerClient();
  let query = supabase
    .from('programs')
    .select('id,name,slug,description,status,visibility,created_at')
    .eq('status', 'active')
    .eq('visibility', 'public');
  if (q.trim()) query = query.ilike('name', `%${escapeLike(q.trim())}%`);
  query = query.order('created_at', { ascending: sort === 'old' }).limit(50);
  const { data: programs } = await query;
  const ids = (programs ?? []).map((p) => p.id);
  const [{ data: bounties }, { data: assetCounts }] = ids.length
    ? await Promise.all([
        supabase.from('bounty_policies').select('program_id,max_amount').in('program_id', ids),
        supabase.from('program_assets').select('program_id').in('program_id', ids),
      ])
    : [{ data: [] }, { data: [] }];
  const maxByProgram = new Map<string, number>();
  for (const b of (bounties ?? []) as { program_id: string; max_amount: number }[]) {
    maxByProgram.set(b.program_id, Math.max(maxByProgram.get(b.program_id) ?? 0, Number(b.max_amount)));
  }
  const assetsByProgram = new Map<string, number>();
  for (const a of (assetCounts ?? []) as { program_id: string }[]) {
    assetsByProgram.set(a.program_id, (assetsByProgram.get(a.program_id) ?? 0) + 1);
  }

  return (
    <main>
      <section className="bg-[#0a1628] text-white">
        <div className="container py-12">
          <span className="inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
            اختبار مصرح به فقط
          </span>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">برامج Bug Bounty</h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            اختر برنامجًا، اقرأ نطاقه وقواعده جيدًا، ثم ابدأ الصيد داخل الحدود المصرح بها فقط.
          </p>
          <div className="mt-6 flex max-w-xl flex-wrap gap-2">
            <ProgramSearch initial={q} />
            <form className="flex gap-2">
              <input type="hidden" name="q" value={q} />
              <select name="sort" defaultValue={sort} aria-label="الترتيب" className="h-10 rounded-md border border-slate-700 bg-white/10 px-3 text-sm text-white">
                <option value="new" className="text-black">الأحدث</option>
                <option value="old" className="text-black">الأقدم</option>
              </select>
              <Button type="submit" variant="outline" className="border-slate-600 text-white hover:bg-white/10">ترتيب</Button>
            </form>
          </div>
        </div>
      </section>

      <section className="container py-10">
        {!programs?.length ? (
          <Card className="mx-auto max-w-lg text-center">
            <CardContent className="p-10">
              <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 font-bold">{q ? `لا نتائج عن “${q}”` : 'لا توجد برامج نشطة حاليًا'}</h2>
              <p className="mt-2 text-sm text-muted-foreground">الشركات تضيف برامج جديدة باستمرار — ارجع قريبًا.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((p) => (
              <Card key={p.id} className="group flex flex-col transition-colors hover:border-slate-400">
                <CardContent className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
                      <AppWindow className="h-5 w-5 text-muted-foreground" />
                    </span>
                    <Badge variant="secondary">عام</Badge>
                  </div>
                  <h2 className="mt-4 text-lg font-bold">{p.name}</h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>حتى <b className="tabular-nums text-foreground" dir="ltr">{(maxByProgram.get(p.id) ?? 0).toLocaleString()} EGP</b></span>
                    <span>•</span>
                    <span>{assetsByProgram.get(p.id) ?? 0} أصول</span>
                  </div>
                  <Link href={`/programs/${p.slug}`} className="mt-5">
                    <Button variant="outline" className="w-full">
                      عرض التفاصيل <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

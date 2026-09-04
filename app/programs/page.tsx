import Link from 'next/link';
import { AppWindow, ArrowLeft, ShieldCheck, Search } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { q = '', sort = 'new' } = await searchParams;
  const supabase = await createServerClient();
  let query = supabase
    .from('programs')
    .select('id,name,slug,description,status,visibility,created_at')
    .eq('status', 'active')
    .eq('visibility', 'public');
  if (q.trim()) query = query.ilike('name', `%${q.trim()}%`);
  query = query.order('created_at', { ascending: sort === 'old' }).limit(50);
  const { data: programs } = await query;

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
          <form className="mt-6 flex max-w-xl gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input name="q" defaultValue={q} placeholder="ابحث باسم البرنامج…" className="border-slate-700 bg-white/10 pr-9 text-white placeholder:text-slate-400" />
            </div>
            <select name="sort" defaultValue={sort} className="h-10 rounded-md border border-slate-700 bg-white/10 px-3 text-sm text-white">
              <option value="new" className="text-black">الأحدث</option>
              <option value="old" className="text-black">الأقدم</option>
            </select>
            <Button type="submit" className="bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">بحث</Button>
          </form>
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

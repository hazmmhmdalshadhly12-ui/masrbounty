import Link from 'next/link';
import { AppWindow, ArrowLeft, ShieldCheck } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function ProgramsPage() {
  const supabase = await createServerClient();
  const { data: programs } = await supabase
    .from('programs')
    .select('id,name,slug,description,status,visibility')
    .eq('status', 'active')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <main>
      {/* Page hero */}
      <section className="bg-[#0a1628] text-white">
        <div className="container py-12">
          <span className="inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
            اختبار مصرح به فقط
          </span>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">برامج Bug Bounty</h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            اختر برنامجًا، اقرأ نطاقه وقواعده جيدًا، ثم ابدأ الصيد داخل الحدود المصرح بها فقط.
          </p>
        </div>
      </section>

      <section className="container py-10">
        {!programs?.length ? (
          <Card className="mx-auto max-w-lg text-center">
            <CardContent className="p-10">
              <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 font-bold">لا توجد برامج نشطة حاليًا</h2>
              <p className="mt-2 text-sm text-muted-foreground">الشركات تضيف برامج جديدة باستمرار — ارجع قريبًا.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((p) => (
              <Card key={p.id} className="group flex flex-col transition-all hover:-translate-y-1 hover:shadow-xl">
                <CardContent className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0a1628] text-amber-400">
                      <AppWindow className="h-5 w-5" />
                    </span>
                    <Badge variant="secondary">عام</Badge>
                  </div>
                  <h2 className="mt-4 text-lg font-black group-hover:text-amber-600">{p.name}</h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
                  <Link href={`/programs/${p.slug}`} className="mt-5">
                    <Button className="w-full bg-[#0a1628] text-white hover:bg-[#16294a]">
                      عرض البرنامج <ArrowLeft className="h-4 w-4" />
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

import { Award } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';

export default async function HallOfFamePage() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('hall_of_fame').select('*').order('recognized_at', { ascending: false }).limit(100);
  return (
    <main>
      <PageHero kicker="تكريم مستحق" title="قاعة المشاهير" desc="باحثون كرّمتهم الشركات علنًا على اكتشافاتهم المميزة." />
      <section className="container py-10">
        {!data?.length ? <p className="text-muted-foreground">No recognitions yet.</p> : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((h) => (
              <Card key={h.id} className="transition-shadow hover:shadow-lg">
                <CardContent className="p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15 text-amber-600">
                    <Award className="h-5 w-5" />
                  </span>
                  <p className="mt-4 font-black">{h.display_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{h.achievement}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

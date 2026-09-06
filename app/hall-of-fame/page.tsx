import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';
import { Avatar } from '@/components/shared/avatar';
import { timeAgo } from '@/utils/time';

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
                <CardContent className="flex gap-4 p-6">
                  <Avatar name={h.display_name} size="lg" />
                  <div className="min-w-0">
                    <p className="font-black">{h.display_name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{h.achievement}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{timeAgo(h.recognized_at)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

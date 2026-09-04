import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHero } from '@/components/layout/page-hero';

export default async function CompaniesPage() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('company_profiles').select('id,name,slug,description,is_verified').order('created_at', { ascending: false }).limit(50);
  return (
    <main>
      <PageHero kicker="شركاء المنصة" title="الشركات" desc="الشركات التي تثق بباحثينا لتأمين منتجاتها عبر برامج Bug Bounty." />
      <section className="container py-10">
        {!data?.length ? <p className="text-muted-foreground">No companies yet.</p> : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((c) => (
              <Card key={c.id} className="group transition-all hover:-translate-y-1 hover:shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0a1628] text-amber-400">
                      <Building2 className="h-5 w-5" />
                    </span>
                    {c.is_verified && <Badge>موثقة ✓</Badge>}
                  </div>
                  <Link href={`/companies/${c.slug}`} className="mt-4 block text-lg font-black group-hover:text-amber-600">
                    {c.name}
                  </Link>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

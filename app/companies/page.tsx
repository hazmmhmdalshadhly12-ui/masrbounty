import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function CompaniesPage() {
  const supabase = createServerClient();
  const { data } = await supabase.from('company_profiles').select('id,name,slug,description,is_verified').order('created_at', { ascending: false }).limit(50);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">الشركات</h1>
      {!data?.length ? <p className="text-muted-foreground">No companies yet.</p> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((c) => (
            <Card key={c.id}><CardHeader><CardTitle><Link href={`/companies/${c.slug}`} className="hover:underline">{c.name}</Link></CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>{c.is_verified && <Badge className="mt-2">Verified</Badge>}</CardContent></Card>
          ))}
        </div>
      )}
    </main>
  );
}

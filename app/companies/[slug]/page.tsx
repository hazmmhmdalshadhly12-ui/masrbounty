import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function CompanyPublic({ params }: { params: { slug: string } }) {
  const supabase = createServerClient();
  const { data: company } = await supabase.from('company_profiles').select('*').eq('slug', params.slug).single();
  if (!company) return <main className="container py-12">Company not found.</main>;
  const { data: programs } = await supabase.from('programs').select('id,name,slug,status').eq('company_id', company.id).eq('status', 'active').eq('visibility', 'public');
  return (
    <main className="container py-8 max-w-3xl space-y-6">
      <div><h1 className="text-3xl font-bold">{company.name}</h1>{company.is_verified && <Badge className="mt-2">Verified</Badge>}{company.description && <p className="mt-3 text-muted-foreground">{company.description}</p>}</div>
      <Card><CardHeader><CardTitle>Active programs ({programs?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>{!programs?.length ? <p className="text-sm text-muted-foreground">None.</p> : programs.map((p) => <Link key={p.id} href={`/programs/${p.slug}`} className="block border rounded p-2 mb-2 hover:bg-accent">{p.name}</Link>)}</CardContent></Card>
    </main>
  );
}

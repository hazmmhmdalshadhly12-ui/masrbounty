import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminCompanies() {
  const supabase = createServerClient();
  const { data } = await supabase.from('company_profiles').select('id,name,slug,is_verified').limit(100);
  const { data: verifs } = await supabase.from('company_verifications').select('id,company_id,status').eq('status', 'pending');
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">الشركات ({data?.length ?? 0}) — توثيق معلق ({verifs?.length ?? 0})</h1>
      {data?.map((c) => <Card key={c.id} className="mb-2"><CardContent className="p-3 flex justify-between"><span>{c.name} ({c.slug})</span>{c.is_verified ? <Badge>verified</Badge> : <Badge variant="secondary">unverified</Badge>}</CardContent></Card>)}
    </main>
  );
}

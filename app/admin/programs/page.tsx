import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminPrograms() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('programs').select('id,name,status,visibility').order('created_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">البرامج</h1>
      {data?.map((p) => <Card key={p.id} className="mb-2"><CardContent className="p-3 flex justify-between"><span>{p.name}</span><span className="flex gap-2"><Badge>{p.status}</Badge><Badge variant="secondary">{p.visibility}</Badge></span></CardContent></Card>)}
    </main>
  );
}

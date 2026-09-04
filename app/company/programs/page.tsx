import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function CompanyPrograms() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: programs } = await supabase.from('programs').select('id,name,slug,status,visibility').order('created_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8">
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">برامج الشركة</h1><Link href="/company/programs/new"><Button>New program</Button></Link></div>
      {!programs?.length ? <p className="text-muted-foreground">No programs yet.</p> :
        programs.map((p) => <Card key={p.id} className="mb-2"><CardHeader><CardTitle><Link href={`/company/programs/${p.id}`} className="hover:underline">{p.name}</Link></CardTitle></CardHeader><CardContent><Badge>{p.status}</Badge> <Badge variant="secondary">{p.visibility}</Badge></CardContent></Card>)}
    </main>
  );
}

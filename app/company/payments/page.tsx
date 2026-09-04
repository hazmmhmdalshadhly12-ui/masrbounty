import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function CompanyPayments() {
  const supabase = createServerClient();
  const { data: awards } = await supabase.from('bounty_awards').select('id,amount,status,created_at').order('created_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">المدفوعات</h1>
      <Card><CardHeader><CardTitle>Awards given</CardTitle></CardHeader><CardContent>
        {!awards?.length ? <p className="text-sm text-muted-foreground">None.</p> : awards.map((a) => <p key={a.id} className="text-sm border-b py-2">{a.amount} EGP — <Badge>{a.status}</Badge></p>)}
      </CardContent></Card>
    </main>
  );
}

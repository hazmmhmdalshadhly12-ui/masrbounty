import { createServerClient } from '@/lib/supabase/server';
import { approvePayoutAction } from '@/features/disputes/services';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function AdminPayments() {
  const supabase = createServerClient();
  const { data } = await supabase.from('payout_requests').select('*').order('created_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">المدفوعات (مراجعة السحب)</h1>
      {!data?.length ? <p className="text-muted-foreground">No payout requests.</p> : data.map((p) => (
        <Card key={p.id} className="mb-2"><CardContent className="p-3 flex justify-between items-center">
          <span className="text-sm">{p.amount} EGP — <Badge>{p.status}</Badge></span>
          {p.status === 'pending' && (
            <span className="flex gap-2">
              <form action={approvePayoutAction.bind(null, p.id, true)}><Button size="sm" type="submit">Approve</Button></form>
              <form action={approvePayoutAction.bind(null, p.id, false)}><Button size="sm" variant="outline" type="submit">Reject</Button></form>
            </span>
          )}
        </CardContent></Card>
      ))}
    </main>
  );
}

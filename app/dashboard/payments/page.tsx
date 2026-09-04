import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function PaymentsPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) return <main className="container py-12">No profile.</main>;
  const { data: awards } = await supabase.from('bounty_awards').select('id,amount,status,created_at,reports!inner(report_number,title,researcher_id)').eq('reports.researcher_id', rp.id).order('created_at', { ascending: false });
  const { data: payouts } = await supabase.from('payout_requests').select('*').eq('researcher_id', rp.id).order('created_at', { ascending: false });
  return (
    <main className="container py-8 space-y-6">
      <h1 className="text-2xl font-bold">المدفوعات</h1>
      <Card><CardHeader><CardTitle>Bounty awards</CardTitle></CardHeader><CardContent>
        {!awards?.length ? <p className="text-sm text-muted-foreground">None yet.</p> : awards.map((a: { id: string; amount: number; status: string }) => <p key={a.id} className="text-sm border-b py-2">{a.amount} EGP — <Badge>{a.status}</Badge></p>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Payout requests</CardTitle></CardHeader><CardContent>
        {!payouts?.length ? <p className="text-sm text-muted-foreground">None yet.</p> : payouts.map((p) => <p key={p.id} className="text-sm border-b py-2">{p.amount} EGP — <Badge>{p.status}</Badge></p>)}
      </CardContent></Card>
    </main>
  );
}

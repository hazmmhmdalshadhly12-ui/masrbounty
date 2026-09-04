import { createServerClient } from '@/lib/supabase/server';
import { requestPayoutAction } from '@/features/wallet/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single();
  if (!rp) return <main className="container py-12">No profile.</main>;
  const [{ data: wallet }, { data: txns }, { data: payouts }, { data: methods }] = await Promise.all([
    supabase.from('wallets').select('*').eq('researcher_id', rp.id).single(),
    supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('payout_requests').select('*').eq('researcher_id', rp.id).order('created_at', { ascending: false }),
    supabase.from('payment_methods').select('*').eq('researcher_id', rp.id),
  ]);

  return (
    <main className="container py-8 space-y-6">
      <h1 className="text-2xl font-bold">المحفظة</h1>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{ok}</p>}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Balance</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{wallet?.balance ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Pending</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{wallet?.pending_balance ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Total earned</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{wallet?.total_earned ?? 0}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Request payout</CardTitle></CardHeader>
        <CardContent>
          {!methods?.length ? <p className="text-sm text-muted-foreground">Add a payment method first (dashboard/settings).</p> : (
            <form action={requestPayoutAction} className="flex gap-2">
              <Input name="amount" type="number" min={1} required placeholder="Amount" />
              <select name="payment_method_id" className="h-10 border rounded-md px-3">
                {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <Button type="submit">Request</Button>
            </form>
          )}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Payouts</CardTitle></CardHeader>
        <CardContent>{!payouts?.length ? <p className="text-sm text-muted-foreground">None.</p> : payouts.map((p) => <p key={p.id} className="text-sm">{p.amount} — {p.status}</p>)}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent>{!txns?.length ? <p className="text-sm text-muted-foreground">None.</p> : txns.map((t) => <p key={t.id} className="text-sm">{t.type}: {t.amount}</p>)}</CardContent>
      </Card>
    </main>
  );
}

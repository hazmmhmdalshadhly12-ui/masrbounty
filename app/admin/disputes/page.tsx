import { createServerClient } from '@/lib/supabase/server';
import { resolveDisputeAction } from '@/features/disputes/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default async function DisputesPage() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('disputes').select('*').order('created_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">النزاعات</h1>
      {!data?.length ? <p className="text-muted-foreground">No disputes.</p> : data.map((d) => (
        <Card key={d.id} className="mb-3"><CardHeader><CardTitle className="text-base">{d.report_id.slice(0, 8)} — <Badge>{d.status}</Badge></CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm mb-3">{d.reason}</p>
            {d.status === 'open' || d.status === 'under_review' ? (
              <form action={resolveDisputeAction.bind(null, d.id)} className="flex gap-2">
                <Input name="resolution" required placeholder="Resolution note" />
                <select name="status" className="h-10 border rounded-md px-2"><option value="resolved">resolved</option><option value="rejected">rejected</option></select>
                <Button size="sm" type="submit">Resolve</Button>
              </form>
            ) : <p className="text-sm text-muted-foreground">{d.resolution}</p>}
          </CardContent></Card>
      ))}
    </main>
  );
}

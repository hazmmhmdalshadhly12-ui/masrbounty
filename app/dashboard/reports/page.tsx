import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function ReportsPage() {
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return (
      <main className="container py-12">
        <p>Please <Link href="/login" className="underline">login</Link>.</p>
      </main>
    );
  }
  const { data: rp } = await supabase
    .from('researcher_profiles')
    .select('id')
    .eq('user_id', user.user.id)
    .single();
  if (!rp) return <main className="container py-12">No researcher profile.</main>;
  const { data: reports } = await supabase
    .from('reports')
    .select('id,report_number,title,status,severity,bounty_amount,created_at')
    .eq('researcher_id', rp.id)
    .order('created_at', { ascending: false });

  return (
    <main className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">تقاريري</h1>
        <Link href="/dashboard/reports/new"><Button>تقرير جديد</Button></Link>
      </div>
      {!reports?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No reports yet. Create your first report.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <Link href={`/dashboard/reports/${r.id}`} className="font-semibold hover:underline">
                    {r.report_number} — {r.title}
                  </Link>
                  <div className="flex gap-2 mt-2">
                    <Badge>{r.status}</Badge>
                    <Badge variant="secondary">{r.severity}</Badge>
                  </div>
                </div>
                <span className="text-sm">{r.bounty_amount ?? 0} EGP</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

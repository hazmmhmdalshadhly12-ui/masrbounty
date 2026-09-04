import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AdminReports() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('report_overview').select('*').order('created_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">كل التقارير</h1>
      {!data?.length ? <p className="text-muted-foreground">None.</p> :
        data.map((r: { id: string; report_number: string; title: string; status: string; company_name: string }) => (
          <Card key={r.id} className="mb-2"><CardContent className="p-3 flex justify-between">
            <span className="text-sm">{r.report_number} — {r.title} ({r.company_name})</span><Badge>{r.status}</Badge>
          </CardContent></Card>
        ))}
      <Link href="/admin" className="underline text-sm">Back</Link>
    </main>
  );
}

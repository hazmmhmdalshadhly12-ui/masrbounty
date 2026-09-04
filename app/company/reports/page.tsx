import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function CompanyReports() {
  const supabase = createServerClient();
  const { data: reports } = await supabase.from('report_overview').select('*').order('created_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">تقارير الشركة</h1>
      {!reports?.length ? <p className="text-muted-foreground">No reports (RLS shows only your programs).</p> :
        reports.map((r: { id: string; report_number: string; title: string; status: string; severity: string }) => (
          <Card key={r.id} className="mb-2"><CardContent className="p-3 flex justify-between items-center">
            <Link href={`/company/reports/${r.id}`} className="font-semibold hover:underline">{r.report_number} — {r.title}</Link>
            <span className="flex gap-2"><Badge>{r.status}</Badge><Badge variant="secondary">{r.severity}</Badge></span>
          </CardContent></Card>
        ))}
    </main>
  );
}

import { createServerClient } from '@/lib/supabase/server';
import { triageReportAction, awardBountyAction } from '@/features/company/services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function CompanyReport({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: report } = await supabase.from('reports').select('*').eq('id', params.id).single();
  if (!report) return <main className="container py-12">Not found.</main>;
  const { data: comments } = await supabase.from('report_comments').select('*').eq('report_id', params.id).order('created_at');

  return (
    <main className="container py-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{report.report_number} — {report.title}</h1>
      <div className="flex gap-2"><Badge>{report.status}</Badge><Badge variant="secondary">{report.severity}</Badge></div>
      <Card><CardContent className="p-4 space-y-2"><p>{report.description}</p><p><b>Impact:</b> {report.impact}</p><p><b>Repro:</b> {report.reproduction_steps}</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Triage</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {['triaged', 'accepted', 'resolved', 'duplicate', 'not_applicable', 'closed'].map((s) => (
            <form key={s} action={triageReportAction.bind(null, report.id, s)}>
              <Button size="sm" variant="outline" type="submit">{s}</Button>
            </form>
          ))}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Award bounty (server-side, credits wallet)</CardTitle></CardHeader>
        <CardContent>
          <form action={awardBountyAction.bind(null, report.id)} className="flex gap-2">
            <Input name="amount" type="number" min={0} required placeholder="Amount EGP" />
            <Button type="submit">Award</Button>
          </form>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Comments ({comments?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>{comments?.map((c) => <p key={c.id} className="text-sm border rounded p-2 mb-2">{c.body}</p>)}</CardContent>
      </Card>
    </main>
  );
}

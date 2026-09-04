import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function ProgramDetail({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createServerClient();
  const { slug } = await params;
  const { data: program } = await supabase.from('programs').select('*').eq('slug', slug).single();
  if (!program) return <main className="container py-12">Program not found.</main>;
  const [{ data: assets }, { data: rules }, { data: bounty }, { data: activity }] = await Promise.all([
    supabase.from('program_assets').select('*').eq('program_id', program.id),
    supabase.from('program_rules').select('*').eq('program_id', program.id).order('sort_order'),
    supabase.from('bounty_policies').select('*').eq('program_id', program.id),
    supabase
      .from('report_events')
      .select('id,from_status,to_status,created_at,reports!inner(program_id)')
      .eq('reports.program_id', program.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return (
    <main className="container py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{program.name}</h1>
        <div className="flex gap-2 mt-2"><Badge>{program.status}</Badge><Badge variant="secondary">{program.visibility}</Badge></div>
        <p className="mt-4 text-muted-foreground">{program.description}</p>
      </div>
      <Card><CardHeader><CardTitle>Scope</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap">{program.scope}</p>
          {program.out_of_scope && <p className="mt-3 text-sm"><b>Out of scope:</b> {program.out_of_scope}</p>}
          {program.safe_harbor && <p className="mt-2 text-sm"><b>Safe harbor:</b> {program.safe_harbor}</p>}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Assets ({assets?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>{!assets?.length ? <p className="text-sm text-muted-foreground">No assets listed.</p> : assets.map((a) => <p key={a.id} className="text-sm border-b py-2"><b>{a.type}</b> — <span dir="ltr">{a.value}</span></p>)}</CardContent>
      </Card>
      {!!rules?.length && (
        <Card><CardHeader><CardTitle>Rules</CardTitle></CardHeader>
          <CardContent>{rules.map((r) => <div key={r.id} className="mb-3"><p className="font-semibold">{r.title}</p><p className="text-sm">{r.content}</p></div>)}</CardContent>
        </Card>
      )}
      {!!bounty?.length && (
        <Card><CardHeader><CardTitle>Bounty ranges</CardTitle></CardHeader>
          <CardContent>{bounty.map((b) => <p key={b.id} className="text-sm">{b.severity}: {b.min_amount} – {b.max_amount} EGP</p>)}</CardContent>
        </Card>
      )}
      {!!activity?.length && (
        <Card><CardHeader><CardTitle>النشاط الأخير</CardTitle></CardHeader>
          <CardContent>
            {activity.map((e: { id: string; from_status: string | null; to_status: string | null; created_at: string }) => (
              <p key={e.id} className="border-b py-2 text-sm last:border-0" dir="ltr">
                {e.from_status ?? '—'} → {e.to_status ?? '—'} <span className="text-muted-foreground">{new Date(e.created_at).toLocaleDateString('ar-EG')}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
      <Link href="/dashboard/reports/new"><Button>Submit a report</Button></Link>
    </main>
  );
}

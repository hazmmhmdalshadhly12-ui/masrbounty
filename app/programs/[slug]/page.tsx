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
  const [{ data: assets }, { data: rules }, { data: bounty }, { data: updates }, { data: activity }] = await Promise.all([
    supabase.from('program_assets').select('*').eq('program_id', program.id),
    supabase.from('program_rules').select('*').eq('program_id', program.id).order('sort_order'),
    supabase.from('bounty_policies').select('*').eq('program_id', program.id),
    supabase.from('program_updates').select('id,title,body,created_at').eq('program_id', program.id).order('created_at', { ascending: false }).limit(5),
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
        <Card><CardHeader><CardTitle>جدول المكافآت (EGP)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">الخطورة</th>
                  <th className="px-4 py-2.5 font-medium">من</th>
                  <th className="px-4 py-2.5 font-medium">إلى</th>
                </tr>
              </thead>
              <tbody>
                {bounty.map((b: { id: string; severity: string; min_amount: number; max_amount: number }) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-bold">{b.severity}</td>
                    <td className="px-4 py-2.5 tabular-nums" dir="ltr">{Number(b.min_amount).toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums" dir="ltr">{Number(b.max_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {!!updates?.length && (
        <Card><CardHeader><CardTitle>تحديثات البرنامج</CardTitle></CardHeader>
          <CardContent>
            {(updates as { id: string; title: string; body: string; created_at: string }[]).map((u) => (
              <div key={u.id} className="mb-3 border-b pb-3 last:border-0">
                <p className="text-sm font-bold">{u.title} <span className="font-normal text-muted-foreground">{new Date(u.created_at).toLocaleDateString('ar-EG')}</span></p>
                <p className="mt-1 text-sm text-muted-foreground">{u.body}</p>
              </div>
            ))}
          </CardContent>
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

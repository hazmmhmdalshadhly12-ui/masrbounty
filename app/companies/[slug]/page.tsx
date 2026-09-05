import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function CompanyPublic({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createServerClient();
  const { slug } = await params;
  const { data: company } = await supabase.from('company_profiles').select('*').eq('slug', slug).single();
  if (!company) return <main className="container py-12">Company not found.</main>;
  const [{ data: programs }, { data: domains }, trust] = await Promise.all([
    supabase.from('programs').select('id,name,slug,status').eq('company_id', company.id).eq('status', 'active').eq('visibility', 'public'),
    supabase.from('domain_verifications').select('domain').eq('company_id', company.id).eq('status', 'verified'),
    supabase.rpc('company_trust', { p_company: company.id }),
  ]);
  const trustRow = (Array.isArray(trust.data) ? trust.data[0] : null) as {
    score: number;
    factors: { resolved_rate: number; avg_response_hours: number; active_programs: number };
  } | null;
  const f = trustRow?.factors;

  return (
    <main className="container py-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{company.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {company.is_verified && <Badge>شركة موثقة ✓</Badge>}
          {(domains ?? []).map((d: { domain: string }) => (
            <Badge key={d.domain} variant="secondary"><span dir="ltr">{d.domain}</span> ✓</Badge>
          ))}
          {trustRow && <Badge variant="outline">ثقة {trustRow.score}/100</Badge>}
        </div>
        {company.description && <p className="mt-3 text-muted-foreground">{company.description}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['برامج نشطة', programs?.length ?? 0],
          ['نسبة الحل', `${f?.resolved_rate ?? 0}%`],
          ['متوسط الرد', `${f?.avg_response_hours ?? 0}h`],
          ['الثقة', `${trustRow?.score ?? 0}`],
        ].map(([label, v]) => (
          <Card key={label as string}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black tabular-nums">{v}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card><CardHeader><CardTitle>البرامج النشطة ({programs?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>{!programs?.length ? <p className="text-sm text-muted-foreground">None.</p> : programs.map((p) => <Link key={p.id} href={`/programs/${p.slug}`} className="block border rounded p-2 mb-2 hover:bg-accent">{p.name}</Link>)}</CardContent></Card>
    </main>
  );
}

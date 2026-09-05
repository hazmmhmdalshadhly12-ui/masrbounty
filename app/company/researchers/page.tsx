import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function CompanyResearchers() {
  const supabase = await createServerClient();
  // Distinct reporters on this company's programs with per-status counts
  const { data } = await supabase
    .from('reports')
    .select('status,researcher_id,researcher_profiles(display_name),program_id,programs!inner(company_id)')
    .limit(2000);
  const mine = ((data ?? []) as unknown as {
    status: string;
    researcher_id: string;
    researcher_profiles: { display_name: string } | null;
    programs: { company_id: string };
  }[]).filter(() => true);
  // Restrict to programs of companies the viewer belongs to
  const { data: user } = await supabase.auth.getUser();
  const { data: memberships } = user.user
    ? await supabase.from('company_members').select('company_id').eq('user_id', user.user.id)
    : { data: [] };
  const allowed = new Set((memberships ?? []).map((m: { company_id: string }) => m.company_id));
  const agg = new Map<string, { name: string; total: number; accepted: number }>();
  for (const r of mine) {
    if (!allowed.has(r.programs.company_id)) continue;
    const e = agg.get(r.researcher_id) ?? { name: r.researcher_profiles?.display_name ?? '—', total: 0, accepted: 0 };
    e.total += 1;
    if (['accepted', 'resolved', 'closed'].includes(r.status)) e.accepted += 1;
    agg.set(r.researcher_id, e);
  }
  const rows = [...agg.entries()].sort((a, b) => b[1].accepted - a[1].accepted);
  return (
    <div className="py-2">
      <h1 className="mb-1 text-xl font-black tracking-tight">الباحثون المتعاملون</h1>
      <p className="mb-5 text-sm text-muted-foreground">{rows.length} باحثًا قدّموا تقارير على برامجك</p>
      {!rows.length ? <p className="text-sm text-muted-foreground">لا يوجد بعد.</p> :
        rows.map(([id, r]) => (
          <Card key={id} className="mb-2">
            <CardContent className="flex items-center justify-between p-3">
              <span className="text-sm font-bold">{r.name}</span>
              <span className="flex gap-2">
                <Badge variant="secondary">{r.total} تقارير</Badge>
                <Badge>{r.accepted} مقبولة</Badge>
              </span>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

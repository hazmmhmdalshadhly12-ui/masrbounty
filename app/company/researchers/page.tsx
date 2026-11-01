import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

type StatRow = {
  researcher_id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  reports_count: number;
  accepted_count: number;
  total_awarded: number;
};

export default async function CompanyResearchers() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="py-2 text-sm">سجّل الدخول أولًا.</div>;

  // Resolve companies the user owns or is a member of.
  const [{ data: memberships }, { data: owned }] = await Promise.all([
    supabase.from('company_members').select('company_id').eq('user_id', user.user.id),
    supabase.from('company_profiles').select('id').eq('owner_id', user.user.id),
  ]);
  const companyIds = [
    ...new Set([
      ...((memberships ?? []) as { company_id: string }[]).map((m) => m.company_id),
      ...((owned ?? []) as { id: string }[]).map((c) => c.id),
    ]),
  ];

  if (!companyIds.length) {
    return (
      <div className="py-2">
        <h1 className="mb-1 text-xl font-black tracking-tight">الباحثون المتعاملون</h1>
        <EmptyState title="لا توجد شركة" hint="أنشئ ملف شركتك أولًا لعرض الباحثين المتعاملين معك." />
      </div>
    );
  }

  // Aggregate in the database (company_researcher_stats) — no bulk client fetch.
  const results = await Promise.all(
    companyIds.map((cid) =>
      supabase.rpc('company_researcher_stats', { p_company: cid }).returns<StatRow[]>()
    )
  );
  const merged = new Map<string, StatRow>();
  for (const res of results) {
    for (const row of (res.data ?? []) as StatRow[]) {
      const prev = merged.get(row.researcher_id);
      if (prev) {
        prev.reports_count += Number(row.reports_count);
        prev.accepted_count += Number(row.accepted_count);
        prev.total_awarded = Number(prev.total_awarded) + Number(row.total_awarded);
      } else {
        merged.set(row.researcher_id, { ...row, reports_count: Number(row.reports_count), accepted_count: Number(row.accepted_count), total_awarded: Number(row.total_awarded) });
      }
    }
  }
  const rows = [...merged.values()].sort((a, b) => b.accepted_count - a.accepted_count || b.reports_count - a.reports_count);

  return (
    <div className="py-2">
      <h1 className="mb-1 text-xl font-black tracking-tight">الباحثون المتعاملون</h1>
      <p className="mb-5 text-sm text-muted-foreground">{rows.length} باحثًا قدّموا تقارير على برامجك</p>
      {!rows.length ? (
        <EmptyState icon={Users} title="لا يوجد بعد" hint="سيظهر هنا الباحثون الذين قدموا تقارير على برامج مؤسستك." />
      ) : (
        rows.map((r) => (
          <Card key={r.researcher_id} className="mb-2">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
              <Link
                href={r.username ? `/researchers/${r.username}` : '/researchers'}
                className="text-sm font-bold hover:underline"
              >
                {r.display_name ?? r.username ?? '—'}
              </Link>
              <span className="flex flex-wrap gap-2">
                <Badge variant="secondary">{r.reports_count} تقارير</Badge>
                <Badge>{r.accepted_count} مقبولة</Badge>
                {Number(r.total_awarded) > 0 && (
                  <Badge variant="outline" className="tabular-nums" dir="ltr">
                    {Number(r.total_awarded).toLocaleString()} EGP
                  </Badge>
                )}
              </span>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

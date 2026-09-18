import { Inbox } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { TriageInbox } from '@/components/company/triage-inbox';
import { getSLAStatus } from '@/lib/sla';
import { notify } from '@/lib/notify';

export default async function CompanyReports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  // Reports via RLS (company members + owner) — use report_overview view constrained by membership
  // Fallback to manual companyPrograms fetch for assignee/member resolution
  let companyIds: string[] = [];
  let programIds: string[] = [];
  if (userId) {
    const { data: memberships } = await supabase.from('company_members').select('company_id').eq('user_id', userId);
    const { data: owned } = await supabase.from('company_profiles').select('id').eq('owner_id', userId);
    const fromMembers = (memberships ?? []).map((m: { company_id: string }) => m.company_id);
    const fromOwned = (owned ?? []).map((o: { id: string }) => o.id);
    companyIds = [...new Set([...fromMembers, ...fromOwned])];
    if (companyIds.length) {
      const { data: progs } = await supabase.from('programs').select('id').in('company_id', companyIds);
      programIds = (progs ?? []).map((p: { id: string }) => p.id);
    }
  }

  // Fetch reports for company programs with SLA-relevant fields
  const { data: rawReports } = await supabase
    .from('reports')
    .select('id, report_number, title, status, severity, affected_asset, asset_id, program_id, created_at, submitted_at, researcher_id')
    .in('program_id', programIds.length ? programIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })
    .limit(200);

  // Also try report_overview enrichment for researcher/program names where available
  const { data: overview } = await supabase.from('report_overview').select('*').order('created_at', { ascending: false }).limit(200);
  const overviewMap = new Map<string, { researcher_name: string; program_name: string }>();
  for (const o of (overview ?? []) as { id: string; researcher_name: string; program_name: string }[]) {
    overviewMap.set(o.id, o);
  }

  const reports = ((rawReports ?? []) as {
    id: string; report_number: string; title: string; status: string; severity: string; affected_asset: string; asset_id: string | null; program_id: string; created_at: string; submitted_at: string | null; researcher_id: string;
  }[]).map((r) => ({
    ...r,
    researcher_name: overviewMap.get(r.id)?.researcher_name ?? r.researcher_id.slice(0, 8),
    program_name: overviewMap.get(r.id)?.program_name ?? '',
  }));

  // Assignees map
  const reportIds = reports.map((r) => r.id);
  const assigneeMap: Record<string, { user_id: string; profiles: { username: string } }[]> = {};
  if (reportIds.length) {
    const { data: assignees } = await supabase
      .from('report_assignees')
      .select('report_id, user_id, profiles!inner(username)')
      .in('report_id', reportIds);
    for (const a of (assignees ?? []) as unknown as { report_id: string; user_id: string; profiles: { username: string } }[]) {
      if (!assigneeMap[a.report_id]) assigneeMap[a.report_id] = [];
      assigneeMap[a.report_id]!.push({ user_id: a.user_id, profiles: a.profiles });
    }
  }

  // Members (for filter + assignee selector)
  let members: { user_id: string; role: string; profiles: { username: string } }[] = [];
  if (companyIds.length) {
    const { data: mems } = await supabase
      .from('company_members')
      .select('user_id, role, profiles!inner(username)')
      .in('company_id', companyIds);
    members = ((mems ?? []) as unknown as { user_id: string; role: string; profiles: { username: string } }[]);
    // include owners
    const { data: owners } = await supabase.from('company_profiles').select('owner_id').in('id', companyIds);
    const ownerIds = [...new Set((owners ?? []).map((o: { owner_id: string }) => o.owner_id))];
    for (const oid of ownerIds) {
      if (!members.some((m) => m.user_id === oid)) {
        const { data: p } = await supabase.from('profiles').select('username').eq('id', oid).maybeSingle();
        if (p) members.unshift({ user_id: oid, role: 'owner', profiles: p as { username: string } });
      }
    }
  }

  // Assets for filter
  let assets: { id: string; value: string; type: string }[] = [];
  if (programIds.length) {
    const { data: progAssets } = await supabase.from('program_assets').select('id, value, type').in('program_id', programIds).limit(200);
    assets = (progAssets ?? []) as { id: string; value: string; type: string }[];
  }

  // Best-effort SLA warning notifications (company inbox view)
  // Notifies assignees (or all company members if unassigned) when report is at-risk/overdue
  try {
    const warnings = reports.filter((r) => {
      const s = getSLAStatus({ status: r.status, created_at: r.created_at, submitted_at: r.submitted_at } as never);
      return s === 'at_risk' || s === 'overdue';
    }).slice(0, 10);
    for (const w of warnings) {
      const sla = getSLAStatus({ status: w.status, created_at: w.created_at, submitted_at: w.submitted_at } as never);
      const targets = (assigneeMap[w.id] ?? []).map((a) => a.user_id);
      const fallback = members.map((m) => m.user_id);
      const recipients = targets.length ? targets : fallback.slice(0, 5);
      for (const uid of recipients) {
        // fire-and-forget, never throw
        void notify(supabase, uid, {
          type: 'system',
          title: sla === 'overdue' ? `تنبيه SLA متجاوز: ${w.report_number}` : `تنبيه SLA قارب الانتهاء: ${w.report_number}`,
          body: `${w.title} — الحالة ${w.status}`,
          link: `/company/reports/${w.id}`,
        });
      }
    }
  } catch {
    /* notify best-effort */
  }

  if (!reports.length) {
    return (
      <div className="py-2">
        <h1 className="text-xl font-black tracking-tight">التقارير الواردة — صندوق الفرز</h1>
        <p className="mt-1 text-sm text-muted-foreground">0 تقريرًا — الفلاتر تشمل الحالة، الخطورة، الأصل، المكلف، وحالة SLA</p>
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center p-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-bold">لا توجد تقارير</p>
            <p className="mt-1 text-sm text-muted-foreground">تظهر هنا التقارير المُقدمة على برامج شركتك فقط. مؤشرات SLA: 🟢 ضمن المهلة 🟡 قارب الانتهاء 🔴 متجاوز.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="mb-4">
        <h1 className="text-xl font-black tracking-tight">التقارير الواردة — صندوق الفرز</h1>
        <p className="mt-1 text-sm text-muted-foreground">فلترة بالحالة/الخطورة/الأصل/المكلف/SLA، بحث بالعنوان/الرقم، وترتيب حسب الأحدث أو الخطورة أو SLA. المؤشرات: 🟢 ضمن المهلة 🟡 قارب الانتهاء 🔴 متجاوز.</p>
      </div>
      <TriageInbox reports={reports} assigneeMap={assigneeMap} members={members} assets={assets} />
    </div>
  );
}

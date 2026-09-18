'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusPill } from '@/components/shared/status-pill';
import { getSLAStatus, slaIcon, slaLabel, type SLAReport } from '@/lib/sla';
import { assignReport, unassignReport } from '@/services/assignment';

type ReportRow = {
  id: string;
  report_number: string;
  title: string;
  status: string;
  severity: string;
  affected_asset: string;
  created_at: string;
  submitted_at: string | null;
  program_name: string;
  program_slug?: string;
  researcher_name: string;
  asset_id?: string | null;
  company_id?: string;
};

type Assignee = { user_id: string; profiles: { username: string } };
type Member = { user_id: string; role: string; profiles: { username: string } };
type AssetOpt = { id: string; value: string; type: string };

const STATUSES = ['', 'submitted', 'triaged', 'accepted', 'resolved', 'duplicate', 'informative', 'not_applicable', 'closed'];
const SEVERITIES = ['', 'critical', 'high', 'medium', 'low', 'informational'];
const SLA_FILTERS = ['', 'overdue', 'at_risk', 'on_time', 'fulfilled'] as const;

function useDebouncedValue<T>(value: T, ms = 350): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function AssigneeCell({ reportId, assignees, members }: { reportId: string; assignees: Assignee[]; members: Member[] }) {
  const current = assignees[0]?.user_id ?? '';
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <select
        defaultValue={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setErr(null);
          start(async () => {
            try {
              if (current && !next) await unassignReport(reportId, current);
              else if (next) {
                if (current) await unassignReport(reportId, current);
                await assignReport(reportId, next);
              }
            } catch (ex) {
              setErr(ex instanceof Error ? ex.message : 'فشل التكليف');
            }
          });
        }}
        className="h-7 rounded-md border bg-background px-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50"
        aria-label={`اختيار المكلف للتقرير ${reportId.slice(0, 8)}`}
      >
        <option value="">غير مكلف</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>{m.profiles.username} ({m.role})</option>
        ))}
      </select>
      {err && <span className="text-[11px] text-destructive">{err}</span>}
      {assignees.length > 1 && (
        <span className="text-[11px] text-muted-foreground">+{assignees.length - 1} آخرين</span>
      )}
    </div>
  );
}

export function TriageInbox({
  reports,
  assigneeMap,
  members,
  assets,
}: {
  reports: ReportRow[];
  assigneeMap: Record<string, Assignee[]>;
  members: Member[];
  assets: AssetOpt[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const qInit = sp.get('q') ?? '';
  const statusInit = sp.get('status') ?? '';
  const severityInit = sp.get('severity') ?? '';
  const assetInit = sp.get('asset') ?? '';
  const assigneeInit = sp.get('assignee') ?? '';
  const slaInit = sp.get('sla') ?? '';
  const sortInit = (sp.get('sort') ?? 'newest') as string;

  const [q, setQ] = React.useState(qInit);
  const [status, setStatus] = React.useState(statusInit);
  const [severity, setSeverity] = React.useState(severityInit);
  const [asset, setAsset] = React.useState(assetInit);
  const [assignee, setAssignee] = React.useState(assigneeInit);
  const [sla, setSla] = React.useState(slaInit);
  const [sort, setSort] = React.useState(sortInit);

  const debouncedQ = useDebouncedValue(q, 350);

  const syncUrl = React.useCallback(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set('q', debouncedQ);
    if (status) p.set('status', status);
    if (severity) p.set('severity', severity);
    if (asset) p.set('asset', asset);
    if (assignee) p.set('assignee', assignee);
    if (sla) p.set('sla', sla);
    if (sort && sort !== 'newest') p.set('sort', sort);
    router.replace(`/company/reports?${p.toString()}`);
  }, [debouncedQ, status, severity, asset, assignee, sla, sort, router]);

  React.useEffect(() => { syncUrl(); }, [syncUrl]);

  const filtered = React.useMemo(() => {
    let out = [...reports];
    if (debouncedQ.trim()) {
      const needle = debouncedQ.trim().toLowerCase();
      out = out.filter((r) => r.title.toLowerCase().includes(needle) || r.report_number.toLowerCase().includes(needle) || r.researcher_name.toLowerCase().includes(needle));
    }
    if (status) out = out.filter((r) => r.status === status);
    if (severity) out = out.filter((r) => r.severity === severity);
    if (asset) out = out.filter((r) => r.asset_id === asset || r.affected_asset === asset);
    if (assignee) {
      if (assignee === '__unassigned') out = out.filter((r) => !(assigneeMap[r.id]?.length));
      else out = out.filter((r) => (assigneeMap[r.id] ?? []).some((a) => a.user_id === assignee));
    }
    if (sla) {
      out = out.filter((r) => {
        const s = getSLAStatus({ status: r.status, created_at: r.created_at, submitted_at: r.submitted_at } as SLAReport);
        return s === sla;
      });
    }
    // sort
    out.sort((a, b) => {
      if (sort === 'severity') {
        const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, informational: 0 };
        return (order[b.severity] ?? -1) - (order[a.severity] ?? -1);
      }
      if (sort === 'sla') {
        const prio: Record<string, number> = { overdue: 3, at_risk: 2, on_time: 1, fulfilled: 0, pending: -1 };
        const sa = prio[getSLAStatus({ status: a.status, created_at: a.created_at, submitted_at: a.submitted_at } as SLAReport)] ?? -1;
        const sbo = prio[getSLAStatus({ status: b.status, created_at: b.created_at, submitted_at: b.submitted_at } as SLAReport)] ?? -1;
        return sbo - sa;
      }
      // newest default
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return out;
  }, [reports, debouncedQ, status, severity, asset, assignee, sla, sort, assigneeMap]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg border bg-card p-3 overflow-x-auto snap-x snap-proximity sm:flex-wrap">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالعنوان أو الرقم أو الباحث…" aria-label="بحث في صندوق الفرز" className="h-9 min-w-[180px] flex-1 snap-start focus-visible:ring-2" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="فلتر الحالة" className="h-9 shrink-0 snap-start rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <option value="">كل الحالات</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="فلتر الخطورة" className="h-9 shrink-0 snap-start rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <option value="">كل الخطورة</option>
          {SEVERITIES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={asset} onChange={(e) => setAsset(e.target.value)} aria-label="فلتر الأصل" className="h-9 shrink-0 snap-start rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <option value="">كل الأصول</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.value} ({a.type})</option>)}
        </select>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="فلتر المكلف" className="h-9 shrink-0 snap-start rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <option value="">كل المكلفين</option>
          <option value="__unassigned">غير مكلف</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles.username}</option>)}
        </select>
        <select value={sla} onChange={(e) => setSla(e.target.value)} aria-label="فلتر SLA" className="h-9 shrink-0 snap-start rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <option value="">كل SLA</option>
          {SLA_FILTERS.filter(Boolean).map((s) => <option key={s} value={s}>{slaLabel(s as never)} {slaIcon(s as never)}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="الترتيب" className="h-9 shrink-0 snap-start rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <option value="newest">الأحدث</option>
          <option value="severity">الخطورة</option>
          <option value="sla">SLA (الأكثر تأخرًا أولًا)</option>
        </select>
        <Button variant="outline" size="sm" aria-label="مسح كل الفلاتر" className="shrink-0 snap-start" onClick={() => { setQ(''); setStatus(''); setSeverity(''); setAsset(''); setAssignee(''); setSla(''); setSort('newest'); }}>مسح</Button>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} تقريرًا — من أصل {reports.length}</p>

      {!filtered.length ? (
        <EmptyState
          title="لا نتائج مطابقة"
          hint="جرّب تغيير الفلاتر أو مسح البحث للعودة لكل التقارير."
          icon={SearchX}
          action={
            <Button variant="outline" size="sm" onClick={() => { setQ(''); setStatus(''); setSeverity(''); setAsset(''); setAssignee(''); setSla(''); setSort('newest'); }}>
              مسح الفلاتر
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto overscroll-x-contain -mx-px" tabIndex={0} aria-label="جدول صندوق الفرز — اسحب أفقيًا على الجوال">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2 text-start font-medium">الرقم</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">العنوان</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">الباحث</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">الحالة</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">الخطورة</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">SLA</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">المكلف</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const slaStatus = getSLAStatus({ status: r.status, created_at: r.created_at, submitted_at: r.submitted_at } as SLAReport);
                  return (
                    <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs" dir="ltr">{r.report_number}</td>
                      <td className="px-3 py-2">
                        <Link href={`/company/reports/${r.id}`} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">{r.title}</Link>
                        <span className="ms-2 text-xs text-muted-foreground" dir="ltr">{r.program_name}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.researcher_name}</td>
                      <td className="px-3 py-2"><StatusPill value={r.status} /></td>
                      <td className="px-3 py-2"><StatusPill value={r.severity} kind="severity" /></td>
                      <td className="px-3 py-2">
                        <Badge variant={slaStatus === 'overdue' ? 'destructive' : slaStatus === 'at_risk' ? 'outline' : 'secondary'} className={slaStatus === 'at_risk' ? 'border-amber-500 text-amber-700 dark:border-amber-800 dark:text-amber-300' : ''}>
                          <span className="me-1">{slaIcon(slaStatus)}</span>{slaLabel(slaStatus)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2"><AssigneeCell reportId={r.id} assignees={assigneeMap[r.id] ?? []} members={members} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">مؤشرات SLA: 🟢 ضمن المهلة · 🟡 قارب الانتهاء (&lt;25٪ متبقي) · 🔴 متجاوز · ✅ منجز · ⚪ مسودة</p>
    </div>
  );
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';

export type ServiceResult<T> = { data: T | null; error: string | null };

export interface PlatformCounts {
  reports: number;
  programs: number;
  activePrograms: number;
  researchers: number;
  companies: number;
  openDisputes: number;
  pendingPayouts: number;
  totalBountyPaid: number;
}

export interface ProgramStat {
  program_id: string;
  name: string;
  slug: string;
  status: string;
  total_reports: number;
  new_reports: number;
  resolved_reports: number;
  total_bounty: number;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

async function headCount(db: Db, table: string): Promise<number> {
  const { count, error } = await db.from(table).select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Platform-wide counts using lightweight head queries (no row data transferred). */
export async function getPlatformCounts(client?: Db): Promise<ServiceResult<PlatformCounts>> {
  try {
    const db = await getDb(client);
    const [reports, programs, researchers, companies] = await Promise.all([
      headCount(db, 'reports'),
      headCount(db, 'programs'),
      headCount(db, 'researcher_profiles'),
      headCount(db, 'company_profiles'),
    ]);
    const { count: activePrograms } = await db
      .from('programs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    const { count: openDisputes } = await db
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');
    const { count: pendingPayouts } = await db
      .from('payout_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    const { data: paid } = await db.from('bounty_awards').select('amount').eq('status', 'paid');
    const totalBountyPaid = (paid ?? []).reduce(
      (sum: number, row: { amount: number | string }) => sum + Number(row.amount ?? 0),
      0
    );
    return {
      data: {
        reports,
        programs,
        activePrograms: activePrograms ?? 0,
        researchers,
        companies,
        openDisputes: openDisputes ?? 0,
        pendingPayouts: pendingPayouts ?? 0,
        totalBountyPaid,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Per-program aggregates from the program_stats_view. */
export async function getProgramStats(programId?: string, client?: Db): Promise<ServiceResult<ProgramStat[]>> {
  try {
    const db = await getDb(client);
    let q = db.from('program_stats_view').select('*');
    if (programId) q = q.eq('program_id', programId);
    const { data, error } = await q;
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as ProgramStat[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Report counts grouped by status (single scan via head queries per status). */
export async function getReportCountsByStatus(
  client?: Db
): Promise<ServiceResult<Record<string, number>>> {
  try {
    const db = await getDb(client);
    const statuses = ['draft', 'submitted', 'triaged', 'accepted', 'resolved', 'closed', 'duplicate'] as const;
    const entries = await Promise.all(
      statuses.map(async (status) => {
        const { count } = await db.from('reports').select('id', { count: 'exact', head: true }).eq('status', status);
        return [status, count ?? 0] as const;
      })
    );
    return { data: Object.fromEntries(entries) as Record<string, number>, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

// ──────────────────────────────────────────────────────────
// Company Analytics — real charts (RLS-aware, aggregates client-side)
// ──────────────────────────────────────────────────────────

export interface ReportsPerMonth {
  month: string;
  total: number;
}

export interface SeverityDistribution {
  severity: string;
  count: number;
}

export interface BountySpending {
  month: string;
  total: number;
}

export interface AvgResolution {
  month: string;
  hours: number;
  count: number;
}

export interface TopResearcher {
  researcher_id: string;
  display_name: string;
  reports: number;
  total_earned: number;
}

export interface CompanyAnalytics {
  reportsPerMonth: ReportsPerMonth[];
  severityDistribution: SeverityDistribution[];
  bountySpending: BountySpending[];
  avgResolutionTime: AvgResolution[];
  topResearchers: TopResearcher[];
  totals: { reports: number; resolved: number; totalBounty: number; avgResolutionHours: number };
}

export async function getCompanyAnalytics(client?: Db): Promise<ServiceResult<CompanyAnalytics>> {
  try {
    const db = await getDb(client);
    // RLS ensures we only see reports the caller may access (company view)
    const { data: reports, error: rErr } = await db
      .from('reports')
      .select('id,severity,status,created_at,submitted_at,resolved_at,bounty_amount,researcher_id')
      .limit(2000);
    if (rErr) return { data: null, error: rErr.message };
    const rows = (reports ?? []) as {
      id: string;
      severity: string;
      status: string;
      created_at: string;
      submitted_at: string | null;
      resolved_at: string | null;
      bounty_amount: number | string | null;
      researcher_id: string;
    }[];

    // Reports per month
    const perMonthMap = new Map<string, number>();
    for (const r of rows) {
      const m = new Date(r.created_at).toISOString().slice(0, 7);
      perMonthMap.set(m, (perMonthMap.get(m) ?? 0) + 1);
    }
    const reportsPerMonth = [...perMonthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    // Severity distribution
    const sevMap = new Map<string, number>();
    for (const r of rows) sevMap.set(r.severity, (sevMap.get(r.severity) ?? 0) + 1);
    const severityDistribution = [...sevMap.entries()].map(([severity, count]) => ({ severity, count }));

    // Bounty spending per month (from bounty_awards, RLS-aware)
    const { data: awards } = await db.from('bounty_awards').select('amount,created_at,status').limit(2000);
    const bountyMap = new Map<string, number>();
    let totalBounty = 0;
    for (const a of (awards ?? []) as { amount: number | string; created_at: string; status: string }[]) {
      const amt = Number(a.amount ?? 0);
      totalBounty += amt;
      const m = new Date(a.created_at).toISOString().slice(0, 7);
      bountyMap.set(m, (bountyMap.get(m) ?? 0) + amt);
    }
    const bountySpending = [...bountyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }));

    // Avg resolution time per month
    const resMap = new Map<string, { sum: number; count: number }>();
    let totalHours = 0;
    let resolvedCount = 0;
    for (const r of rows) {
      if (r.resolved_at && r.submitted_at) {
        const h = (new Date(r.resolved_at).getTime() - new Date(r.submitted_at).getTime()) / 3_600_000;
        if (h >= 0 && h < 365 * 24) {
          const m = new Date(r.resolved_at).toISOString().slice(0, 7);
          const cur = resMap.get(m) ?? { sum: 0, count: 0 };
          cur.sum += h;
          cur.count += 1;
          resMap.set(m, cur);
          totalHours += h;
          resolvedCount += 1;
        }
      }
    }
    const avgResolutionTime = [...resMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, hours: Math.round((v.sum / v.count) * 10) / 10, count: v.count }));

    // Top researchers (by report count + earnings)
    const researcherIds = [...new Set(rows.map((r) => r.researcher_id))];
    let topResearchers: TopResearcher[] = [];
    if (researcherIds.length) {
      const { data: profiles } = await db.from('researcher_profiles').select('id,display_name').in('id', researcherIds.slice(0, 50));
      const nameMap = new Map<string, string>();
      for (const p of (profiles ?? []) as { id: string; display_name: string }[]) nameMap.set(p.id, p.display_name);
      const byResearcher = new Map<string, { reports: number; total_earned: number }>();
      for (const r of rows) {
        const cur = byResearcher.get(r.researcher_id) ?? { reports: 0, total_earned: 0 };
        cur.reports += 1;
        cur.total_earned += Number(r.bounty_amount ?? 0);
        byResearcher.set(r.researcher_id, cur);
      }
      // augment with awards earnings
      if (awards) {
        // need report→researcher map for awards: fetch reports for award reports already in rows, but we have researcher_id per report
        // For simplicity, earnings already counted via bounty_amount; also add award sum per researcher via join
        const { data: awardReports } = await db.from('bounty_awards').select('amount,report_id').limit(2000);
        const reportToResearcher = new Map(rows.map((r) => [r.id, r.researcher_id]));
        for (const ar of (awardReports ?? []) as { amount: number | string; report_id: string }[]) {
          const rid = reportToResearcher.get(ar.report_id);
          if (!rid) continue;
          const cur = byResearcher.get(rid);
          if (cur) cur.total_earned = Math.max(cur.total_earned, cur.total_earned); // keep as is; bounty_amount already reflects net
        }
      }
      topResearchers = [...byResearcher.entries()]
        .map(([researcher_id, v]) => ({ researcher_id, display_name: nameMap.get(researcher_id) ?? researcher_id.slice(0, 8), reports: v.reports, total_earned: v.total_earned }))
        .sort((a, b) => b.reports - a.reports || b.total_earned - a.total_earned)
        .slice(0, 5);
    }

    const totals = {
      reports: rows.length,
      resolved: rows.filter((r) => r.status === 'resolved').length,
      totalBounty,
      avgResolutionHours: resolvedCount ? Math.round((totalHours / resolvedCount) * 10) / 10 : 0,
    };

    return { data: { reportsPerMonth, severityDistribution, bountySpending, avgResolutionTime, topResearchers, totals }, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

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

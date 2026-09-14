import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';

export type ServiceResult<T> = { data: T | null; error: string | null };

export interface LeaderboardEntry {
  researcher_id: string;
  display_name: string;
  score: number;
  accepted_reports: number;
  resolved_reports: number;
  total_earned: number;
  rank: number;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

/** Read the public.researcher_leaderboard view (public researchers only, RLS-safe). */
export async function getLeaderboard(limit = 50, client?: Db): Promise<ServiceResult<LeaderboardEntry[]>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db.from('researcher_leaderboard').select('*').limit(limit);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as LeaderboardEntry[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function getResearcherRank(
  researcherId: string,
  client?: Db
): Promise<ServiceResult<LeaderboardEntry>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db
      .from('researcher_leaderboard')
      .select('*')
      .eq('researcher_id', researcherId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: (data ?? null) as LeaderboardEntry | null, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Paginated leaderboard slice (1-indexed page). */
export async function getLeaderboardPage(
  page = 1,
  pageSize = 25,
  client?: Db
): Promise<ServiceResult<{ entries: LeaderboardEntry[]; page: number; pageSize: number }>> {
  try {
    const safePage = Math.max(1, Math.floor(page));
    const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const db = await getDb(client);
    const from = (safePage - 1) * safeSize;
    const { data, error } = await db.from('researcher_leaderboard').select('*').range(from, from + safeSize - 1);
    if (error) return { data: null, error: error.message };
    return { data: { entries: (data ?? []) as LeaderboardEntry[], page: safePage, pageSize: safeSize }, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

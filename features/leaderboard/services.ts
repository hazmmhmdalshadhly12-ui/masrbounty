'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { leaderboardQuerySchema } from './schemas';

export async function listLeaderboard(limit = 20) {
  const parsed = leaderboardQuerySchema.safeParse({ limit });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid query');
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('researcher_leaderboard')
    .select('researcher_id,display_name,avatar_url,score,accepted_reports,resolved_reports,total_earned,rank')
    .order('score', { ascending: false })
    .limit(parsed.data.limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getResearcherRank(researcherId: string) {
  if (!researcherId) throw new Error('Researcher id required');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data, error } = await supabase
    .from('researcher_leaderboard')
    .select('researcher_id,display_name,score,rank')
    .eq('researcher_id', researcherId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function snapshotLeaderboardAction(formData: FormData) {
  const period = String(formData.get('period') ?? 'global');
  if (!['global', 'monthly'].includes(period)) throw new Error('Invalid period');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin');
  if (!isAdmin) throw new Error('Forbidden: admin only');
  const { data: leaders, error: readErr } = await supabase
    .from('researcher_leaderboard')
    .select('researcher_id,score,rank')
    .limit(100);
  if (readErr) throw new Error(readErr.message);
  if (leaders && leaders.length > 0) {
    const rows = (leaders as { researcher_id: string; score: number; rank: number }[]).map((l) => ({
      period,
      researcher_id: l.researcher_id,
      score: l.score,
      rank: l.rank,
    }));
    const { error } = await supabase.from('leaderboard_snapshots').insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/leaderboard');
}

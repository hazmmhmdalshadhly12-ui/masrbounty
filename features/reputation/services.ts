'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

export async function listReputation(limit = 20) {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { data, error } = await supabase
    .from('researcher_reputation')
    .select('id,researcher_id,score,rank,created_at,updated_at')
    .order('score', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getResearcherReputation(researcherId: string) {
  if (!researcherId) throw new Error('Researcher id required');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const [{ data: rep }, { data: stats }] = await Promise.all([
    supabase.from('researcher_reputation').select('*').eq('researcher_id', researcherId).maybeSingle(),
    supabase.from('researcher_stats').select('*').eq('researcher_id', researcherId).maybeSingle(),
  ]);
  return { reputation: rep, stats };
}

export async function refreshReputationAction(researcherId: string) {
  if (!researcherId) throw new Error('Researcher id required');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const { error } = await supabase.rpc('refresh_researcher_stats', { p_researcher: researcherId });
  if (error) throw new Error(error.message);
  revalidatePath('/leaderboard');
  revalidatePath(`/researchers/${researcherId}`);
}

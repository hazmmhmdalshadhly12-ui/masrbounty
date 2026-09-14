'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { ReputationWithStats } from './types';

export function useReputation(researcherId?: string) {
  return useQuery({
    queryKey: ['reputation', researcherId ?? 'top'],
    queryFn: async (): Promise<ReputationWithStats[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('researcher_reputation')
        .select('id,researcher_id,score,rank,created_at,updated_at')
        .order('score', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return ((data ?? []) as ReputationWithStats[]).map((r) => ({ ...r, stats: null }));
    },
  });
}

export function useResearcherStats(researcherId: string) {
  return useQuery({
    queryKey: ['reputation', 'stats', researcherId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('researcher_stats')
        .select('*')
        .eq('researcher_id', researcherId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: Boolean(researcherId),
  });
}

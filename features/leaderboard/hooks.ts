'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { LeaderboardEntry } from './types';

export function useLeaderboard(limit = 20) {
  return useQuery({
    queryKey: ['leaderboard', limit],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('researcher_leaderboard')
        .select('researcher_id,display_name,avatar_url,score,accepted_reports,resolved_reports,total_earned,rank')
        .order('score', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as LeaderboardEntry[];
    },
  });
}

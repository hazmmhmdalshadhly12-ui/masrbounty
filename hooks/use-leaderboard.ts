'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// المتصدرون — من العرض العام researcher_leaderboard (قراءة عامة)
export interface LeaderboardEntry {
  researcher_id: string;
  display_name: string;
  score: number;
  accepted_reports: number;
  resolved_reports: number;
  total_earned: number | string;
  rank: number;
}

export function useLeaderboard(limit = 20) {
  return useQuery({
    queryKey: ['leaderboard', limit],
    staleTime: 60_000,
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('researcher_leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as LeaderboardEntry[];
    },
  });
}

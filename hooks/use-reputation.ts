'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// سمعة الباحث + إحصائياته (قراءة عامة)
export interface ReputationData {
  score: number;
  rank: number | null;
  totalReports: number;
  acceptedReports: number;
  resolvedReports: number;
  totalEarned: number;
}

export function useReputation(researcherId?: string) {
  return useQuery({
    queryKey: ['reputation', researcherId ?? 'none'],
    staleTime: 60_000,
    enabled: !!researcherId,
    queryFn: async (): Promise<ReputationData> => {
      const supabase = createClient();
      const rid = researcherId as string;
      const [{ data: rep }, { data: stats }] = await Promise.all([
        supabase.from('researcher_reputation').select('score,rank').eq('researcher_id', rid).single(),
        supabase
          .from('researcher_stats')
          .select('total_reports,accepted_reports,resolved_reports,total_earned')
          .eq('researcher_id', rid)
          .single(),
      ]);
      const r = (rep ?? {}) as { score?: number; rank?: number | null };
      const s = (stats ?? {}) as {
        total_reports?: number;
        accepted_reports?: number;
        resolved_reports?: number;
        total_earned?: number | string;
      };
      return {
        score: Number(r.score ?? 0),
        rank: r.rank ?? null,
        totalReports: Number(s.total_reports ?? 0),
        acceptedReports: Number(s.accepted_reports ?? 0),
        resolvedReports: Number(s.resolved_reports ?? 0),
        totalEarned: Number(s.total_earned ?? 0),
      };
    },
  });
}

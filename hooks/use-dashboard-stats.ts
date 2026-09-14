'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// إحصائيات لوحة تحكم الباحث — تجميع من researcher_stats + السمعة + المحفظة
export interface DashboardStats {
  totalReports: number;
  acceptedReports: number;
  resolvedReports: number;
  totalEarned: number;
  reputationScore: number;
  walletBalance: number;
  pendingBalance: number;
}

async function resolveResearcherId(
  supabase: ReturnType<typeof createClient>,
  researcherId?: string,
): Promise<string> {
  if (researcherId) return researcherId;
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('Not authenticated');
  const { data: rp, error } = await supabase
    .from('researcher_profiles')
    .select('id')
    .eq('user_id', uid)
    .single();
  if (error || !rp) throw new Error('Researcher profile not found');
  return (rp as { id: string }).id;
}

export function useDashboardStats(researcherId?: string) {
  return useQuery({
    queryKey: ['dashboard-stats', researcherId ?? 'me'],
    staleTime: 60_000,
    queryFn: async (): Promise<DashboardStats> => {
      const supabase = createClient();
      const rid = await resolveResearcherId(supabase, researcherId);

      const [statsRes, repRes, walletRes] = await Promise.all([
        supabase.from('researcher_stats').select('*').eq('researcher_id', rid).single(),
        supabase.from('researcher_reputation').select('score').eq('researcher_id', rid).single(),
        supabase.from('wallets').select('balance,pending_balance,total_earned').eq('researcher_id', rid).single(),
      ]);

      const stats = (statsRes.data ?? {}) as {
        total_reports?: number;
        accepted_reports?: number;
        resolved_reports?: number;
        total_earned?: number | string;
      };
      const rep = (repRes.data ?? {}) as { score?: number };
      const wallet = (walletRes.data ?? {}) as {
        balance?: number | string;
        pending_balance?: number | string;
        total_earned?: number | string;
      };

      return {
        totalReports: Number(stats.total_reports ?? 0),
        acceptedReports: Number(stats.accepted_reports ?? 0),
        resolvedReports: Number(stats.resolved_reports ?? 0),
        totalEarned: Number(stats.total_earned ?? wallet.total_earned ?? 0),
        reputationScore: Number(rep.score ?? 0),
        walletBalance: Number(wallet.balance ?? 0),
        pendingBalance: Number(wallet.pending_balance ?? 0),
      };
    },
  });
}

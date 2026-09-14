'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// إحصائيات المنصة للإدارة (تتطلب صلاحية admin/moderator حسب RLS)
export interface AdminStats {
  totalUsers: number;
  totalPrograms: number;
  totalReports: number;
  pendingPayouts: number;
  openDisputes: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    staleTime: 60_000,
    queryFn: async (): Promise<AdminStats> => {
      const supabase = createClient();
      const [users, programs, reports, payouts, disputes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('programs').select('id', { count: 'exact', head: true }),
        supabase.from('reports').select('id', { count: 'exact', head: true }),
        supabase.from('payout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      if (users.error) throw users.error;
      if (programs.error) throw programs.error;
      if (reports.error) throw reports.error;
      if (payouts.error) throw payouts.error;
      if (disputes.error) throw disputes.error;
      return {
        totalUsers: users.count ?? 0,
        totalPrograms: programs.count ?? 0,
        totalReports: reports.count ?? 0,
        pendingPayouts: payouts.count ?? 0,
        openDisputes: disputes.count ?? 0,
      };
    },
  });
}

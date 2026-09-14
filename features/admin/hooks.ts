'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { AdminDashboardStats, AuditLog } from './types';

export function useAdmin() {
  return useQuery({
    queryKey: ['admin'],
    queryFn: async (): Promise<AdminDashboardStats> => {
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Unauthorized');
      const [users, programs, reports, pending, payouts, disputes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('programs').select('id', { count: 'exact', head: true }),
        supabase.from('reports').select('id', { count: 'exact', head: true }),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('payout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      return {
        totalUsers: users.count ?? 0,
        totalPrograms: programs.count ?? 0,
        totalReports: reports.count ?? 0,
        pendingReports: pending.count ?? 0,
        totalPayoutsPending: payouts.count ?? 0,
        openDisputes: disputes.count ?? 0,
      };
    },
  });
}

export function useAuditLogs(limit = 50) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', limit],
    queryFn: async (): Promise<AuditLog[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id,actor_id,action,entity,entity_id,metadata,created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as AuditLog[];
    },
  });
}

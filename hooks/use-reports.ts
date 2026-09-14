'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// التقارير — تُرشّح حسب الباحث أو البرنامج أو الحالة (RLS تحدّد الظاهر)
export interface ReportRow {
  id: string;
  report_number: string;
  program_id: string;
  researcher_id: string;
  title: string;
  status: string;
  severity: string;
  bounty_amount: number | string;
  created_at: string;
}

export interface ReportsFilter {
  researcherId?: string;
  programId?: string;
  status?: string;
  limit?: number;
}

export function useReports(filter?: ReportsFilter) {
  const researcherId = filter?.researcherId ?? 'all';
  const programId = filter?.programId ?? 'all';
  const status = filter?.status ?? 'all';
  const limit = filter?.limit ?? 20;

  return useQuery({
    queryKey: ['reports', researcherId, programId, status, limit],
    staleTime: 30_000,
    queryFn: async (): Promise<ReportRow[]> => {
      const supabase = createClient();
      let q = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(limit);
      if (filter?.researcherId) q = q.eq('researcher_id', filter.researcherId);
      if (filter?.programId) q = q.eq('program_id', filter.programId);
      if (filter?.status) q = q.eq('status', filter.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });
}

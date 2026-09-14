'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// المنازعات — يراها صاحبها أو فريق الشركة أو الإدارة (RLS)
export interface Dispute {
  id: string;
  report_id: string;
  opened_by: string;
  reason: string;
  status: string;
  resolution: string | null;
  created_at: string;
}

export function useDisputes(reportId?: string) {
  return useQuery({
    queryKey: ['disputes', reportId ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<Dispute[]> => {
      const supabase = createClient();
      let q = supabase.from('disputes').select('*').order('created_at', { ascending: false });
      if (reportId) q = q.eq('report_id', reportId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Dispute[];
    },
  });
}

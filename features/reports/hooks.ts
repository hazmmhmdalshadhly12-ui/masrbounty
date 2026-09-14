'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Report, ReportComment } from './types';

export function useReports(programId?: string) {
  return useQuery({
    queryKey: ['reports', programId ?? 'mine'],
    queryFn: async (): Promise<Report[]> => {
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Unauthorized');
      let q = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(50);
      if (programId) q = q.eq('program_id', programId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Report[];
    },
  });
}

export function useReportComments(reportId: string) {
  return useQuery({
    queryKey: ['reports', reportId, 'comments'],
    queryFn: async (): Promise<ReportComment[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report_comments')
        .select('id,report_id,author_id,body,is_internal,created_at,updated_at')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ReportComment[];
    },
    enabled: Boolean(reportId),
  });
}

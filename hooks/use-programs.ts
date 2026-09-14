'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// البرامج النشطة العامة (RLS عبر can_view_program)
export interface ProgramRow {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  visibility: string;
  created_at: string;
}

export interface ProgramsFilter {
  status?: string;
  search?: string;
  limit?: number;
}

export function usePrograms(filter?: ProgramsFilter) {
  const status = filter?.status ?? 'active';
  const search = filter?.search ?? '';
  const limit = filter?.limit ?? 20;

  return useQuery({
    queryKey: ['programs', status, search, limit],
    staleTime: 60_000,
    queryFn: async (): Promise<ProgramRow[]> => {
      const supabase = createClient();
      let q = supabase
        .from('programs')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (search.trim().length > 0) q = q.ilike('name', `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProgramRow[];
    },
  });
}

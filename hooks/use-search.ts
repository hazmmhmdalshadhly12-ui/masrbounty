'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// بحث البرامج العامة بالاسم (حد أدنى حرفان)
export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export function useSearch(query: string, limit = 10) {
  const q = query.trim();
  return useQuery({
    queryKey: ['search', q, limit],
    staleTime: 30_000,
    enabled: q.length >= 2,
    queryFn: async (): Promise<SearchResult[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('programs')
        .select('id,name,slug,status')
        .eq('status', 'active')
        .ilike('name', `%${q}%`)
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as SearchResult[];
    },
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { SearchHit, SearchScope } from './types';

export function useSearch(query: string, scope: SearchScope = 'all') {
  return useQuery({
    queryKey: ['search', query, scope],
    queryFn: async (): Promise<SearchHit[]> => {
      const q = query.trim();
      if (q.length < 2) return [];
      const supabase = createClient();
      const like = `%${q}%`;
      const hits: SearchHit[] = [];
      if (scope === 'programs' || scope === 'all') {
        const { data, error } = await supabase
          .from('programs')
          .select('id,name,slug,description,status,created_at')
          .ilike('name', like)
          .eq('status', 'active')
          .limit(10);
        if (error) throw new Error(error.message);
        for (const p of (data ?? []) as { id: string; name: string; slug: string; description: string; status: string; created_at: string }[]) {
          hits.push({ kind: 'program', ...p });
        }
      }
      if (scope === 'researchers' || scope === 'all') {
        const { data, error } = await supabase
          .from('researcher_leaderboard')
          .select('researcher_id,display_name,avatar_url,score')
          .ilike('display_name', like)
          .limit(10);
        if (error) throw new Error(error.message);
        for (const r of (data ?? []) as { researcher_id: string; display_name: string; avatar_url: string | null; score: number }[]) {
          hits.push({ kind: 'researcher', id: r.researcher_id, display_name: r.display_name, avatar_url: r.avatar_url, score: r.score });
        }
      }
      return hits;
    },
    enabled: query.trim().length >= 2,
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { HallOfFameEntry } from './types';

export function useHallOfFame(limit = 20) {
  return useQuery({
    queryKey: ['hall-of-fame', limit],
    queryFn: async (): Promise<HallOfFameEntry[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('hall_of_fame')
        .select('id,researcher_id,company_id,program_id,achievement,display_name,recognized_at')
        .order('recognized_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Omit<HallOfFameEntry, 'created_at'>[]).map((e) => ({
        ...e,
        created_at: e.recognized_at,
      }));
    },
  });
}

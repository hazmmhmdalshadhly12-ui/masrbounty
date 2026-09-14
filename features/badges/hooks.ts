'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Badge, ResearcherBadge } from './types';

export function useBadges() {
  return useQuery({
    queryKey: ['badges'],
    queryFn: async (): Promise<Badge[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('badges')
        .select('id,code,name_ar,name_en,description_ar,description_en,icon,created_at')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Badge[];
    },
  });
}

export function useResearcherBadges(researcherId: string) {
  return useQuery({
    queryKey: ['badges', 'researcher', researcherId],
    queryFn: async (): Promise<ResearcherBadge[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('researcher_badges')
        .select('id,researcher_id,badge_id,awarded_at')
        .eq('researcher_id', researcherId)
        .order('awarded_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ResearcherBadge[];
    },
    enabled: Boolean(researcherId),
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// الشارات: الكتالوج العام + شارات الباحث (قراءة عامة)
export interface Badge {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_en: string | null;
  icon: string | null;
}

export interface ResearcherBadge {
  id: string;
  researcher_id: string;
  badge_id: string;
  awarded_at: string;
  badges?: Badge | null;
}

export interface BadgesData {
  catalog: Badge[];
  earned: ResearcherBadge[];
}

export function useBadges(researcherId?: string) {
  return useQuery({
    queryKey: ['badges', researcherId ?? 'all'],
    staleTime: 60_000,
    queryFn: async (): Promise<BadgesData> => {
      const supabase = createClient();
      const { data: catalog, error } = await supabase
        .from('badges')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;

      let earned: ResearcherBadge[] = [];
      if (researcherId) {
        const { data, error: eErr } = await supabase
          .from('researcher_badges')
          .select('*, badges(*)')
          .eq('researcher_id', researcherId);
        if (eErr) throw eErr;
        earned = (data ?? []) as ResearcherBadge[];
      }

      return {
        catalog: (catalog ?? []) as Badge[],
        earned,
      };
    },
  });
}

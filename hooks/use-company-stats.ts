'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// إحصائيات الشركة: برامجها وتقاريرها (تحترم RLS عبر can_view_program)
export interface CompanyStats {
  totalPrograms: number;
  activePrograms: number;
  totalReports: number;
  newReports: number;
  resolvedReports: number;
  totalBounty: number;
}

export function useCompanyStats(companyId: string) {
  return useQuery({
    queryKey: ['company-stats', companyId],
    staleTime: 60_000,
    enabled: companyId.length > 0,
    queryFn: async (): Promise<CompanyStats> => {
      const supabase = createClient();
      const { data: programs, error: pErr } = await supabase
        .from('programs')
        .select('id,status')
        .eq('company_id', companyId);
      if (pErr) throw pErr;

      const list = (programs ?? []) as { id: string; status: string }[];
      const programIds = list.map((p) => p.id);

      let totalReports = 0;
      let newReports = 0;
      let resolvedReports = 0;
      let totalBounty = 0;

      if (programIds.length > 0) {
        const { data: reports, error: rErr } = await supabase
          .from('reports')
          .select('status,bounty_amount')
          .in('program_id', programIds);
        if (rErr) throw rErr;
        const rows = (reports ?? []) as { status: string; bounty_amount: number | string | null }[];
        totalReports = rows.length;
        newReports = rows.filter((r) => r.status === 'submitted').length;
        resolvedReports = rows.filter((r) => r.status === 'resolved').length;
        totalBounty = rows.reduce((sum, r) => sum + Number(r.bounty_amount ?? 0), 0);
      }

      return {
        totalPrograms: list.length,
        activePrograms: list.filter((p) => p.status === 'active').length,
        totalReports,
        newReports,
        resolvedReports,
        totalBounty,
      };
    },
  });
}

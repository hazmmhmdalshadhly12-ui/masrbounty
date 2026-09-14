'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CompanyMember, CompanyProfile } from './types';

export function useCompany(companyId?: string) {
  return useQuery({
    queryKey: ['company', companyId ?? 'mine'],
    queryFn: async (): Promise<CompanyProfile | null> => {
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Unauthorized');
      if (companyId) {
        const { data, error } = await supabase.from('company_profiles').select('*').eq('id', companyId).single();
        if (error) throw new Error(error.message);
        return data as CompanyProfile;
      }
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('owner_id', user.user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as CompanyProfile | null;
    },
  });
}

export function useCompanyMembers(companyId: string) {
  return useQuery({
    queryKey: ['company', companyId, 'members'],
    queryFn: async (): Promise<CompanyMember[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('company_members').select('*').eq('company_id', companyId);
      if (error) throw new Error(error.message);
      return (data ?? []) as CompanyMember[];
    },
    enabled: Boolean(companyId),
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Program } from './types';

export function usePrograms(status: string = 'active') {
  return useQuery({
    queryKey: ['programs', status],
    queryFn: async (): Promise<Program[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as Program[];
    },
  });
}

export function useProgram(programId: string) {
  return useQuery({
    queryKey: ['programs', 'detail', programId],
    queryFn: async (): Promise<Program | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('programs').select('*').eq('id', programId).single();
      if (error) throw new Error(error.message);
      return data as Program;
    },
    enabled: Boolean(programId),
  });
}

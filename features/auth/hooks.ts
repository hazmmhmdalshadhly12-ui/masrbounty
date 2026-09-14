'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { SessionUser } from './types';

export function useAuth() {
  return useQuery({
    queryKey: ['auth'],
    queryFn: async (): Promise<SessionUser | null> => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .maybeSingle();
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', data.user.id);
      return {
        id: data.user.id,
        email: data.user.email ?? null,
        username: (profile as { username: string } | null)?.username ?? null,
        roles: ((roles ?? []) as { role: SessionUser['roles'][number] }[]).map((r) => r.role),
      };
    },
  });
}

export function useSessionUser() {
  return useAuth();
}

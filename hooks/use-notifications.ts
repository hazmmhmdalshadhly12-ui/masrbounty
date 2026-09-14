'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// إشعارات المستخدم الحالي (RLS: user_id = auth.uid())
export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications(userId?: string, limit = 50) {
  return useQuery({
    queryKey: ['notifications', userId ?? 'me', limit],
    staleTime: 30_000,
    queryFn: async (): Promise<NotificationRow[]> => {
      const supabase = createClient();
      let uid = userId;
      if (!uid) {
        const { data } = await supabase.auth.getUser();
        uid = data.user?.id;
        if (!uid) throw new Error('Not authenticated');
      }
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });
}

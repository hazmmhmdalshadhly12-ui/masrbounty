'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Notification } from './types';

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: ['notifications', unreadOnly ? 'unread' : 'all'],
    queryFn: async (): Promise<Notification[]> => {
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Unauthorized');
      let q = supabase
        .from('notifications')
        .select('id,user_id,type,title,body,link,is_read,created_at')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (unreadOnly) q = q.eq('is_read', false);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Notification[];
    },
  });
}

export function useUnreadCount() {
  const q = useNotifications(true);
  return { ...q, count: (q.data ?? []).length };
}

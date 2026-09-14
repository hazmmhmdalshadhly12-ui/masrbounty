'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Conversation, Message } from './types';

export function useMessaging(conversationId?: string) {
  return useQuery({
    queryKey: ['messaging', conversationId ?? 'conversations'],
    queryFn: async (): Promise<Conversation[]> => {
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Unauthorized');
      const { data: memberships, error: mErr } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.user.id);
      if (mErr) throw new Error(mErr.message);
      const ids = ((memberships ?? []) as { conversation_id: string }[]).map((m) => m.conversation_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .in('id', ids)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Conversation[];
    },
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ['messaging', 'messages', conversationId],
    queryFn: async (): Promise<Message[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('messages')
        .select('id,conversation_id,sender_id,body,created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Message[];
    },
    enabled: Boolean(conversationId),
  });
}

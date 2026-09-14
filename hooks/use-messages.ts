'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// الرسائل: بدون معرّف = محادثات المستخدم، مع معرّف = رسائل المحادثة
export interface Conversation {
  id: string;
  subject: string | null;
  report_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface MessagesData {
  conversations: Conversation[];
  messages: Message[];
}

export function useMessages(conversationId?: string) {
  return useQuery({
    queryKey: ['messages', conversationId ?? 'conversations'],
    staleTime: 30_000,
    queryFn: async (): Promise<MessagesData> => {
      const supabase = createClient();

      if (conversationId) {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(100);
        if (error) throw error;
        return { conversations: [], messages: (data ?? []) as Message[] };
      }

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Not authenticated');

      const { data: memberships, error: mErr } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', uid);
      if (mErr) throw mErr;

      const ids = ((memberships ?? []) as { conversation_id: string }[]).map((m) => m.conversation_id);
      if (ids.length === 0) return { conversations: [], messages: [] };

      const { data: convs, error: cErr } = await supabase
        .from('conversations')
        .select('*')
        .in('id', ids)
        .order('updated_at', { ascending: false })
        .limit(30);
      if (cErr) throw cErr;
      return { conversations: (convs ?? []) as Conversation[], messages: [] };
    },
  });
}

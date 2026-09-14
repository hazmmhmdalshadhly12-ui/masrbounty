export interface MessagingItem {
  id: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  subject: string | null;
  report_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  created_at: string;
}

export interface Message extends MessagingItem {
  conversation_id: string;
  sender_id: string;
  body: string;
}

export interface ConversationWithMembers extends Conversation {
  members: ConversationMember[];
  last_message?: Message | null;
  unread_count?: number;
}

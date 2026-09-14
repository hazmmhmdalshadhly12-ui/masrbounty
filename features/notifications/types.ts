export interface NotificationsItem {
  id: string;
  created_at: string;
}

export type NotificationType =
  | 'report'
  | 'comment'
  | 'bounty'
  | 'payment'
  | 'program'
  | 'message'
  | 'system'
  | 'dispute'
  | 'badge';

export interface Notification extends NotificationsItem {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_reports: boolean;
  email_bounty: boolean;
  email_messages: boolean;
  email_program: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminItem {
  id: string;
  created_at: string;
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'award'
  | 'payout'
  | 'moderate'
  | 'verify';

export interface AuditLog extends AdminItem {
  actor_id: string | null;
  action: AuditAction;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
}

export interface ModerationAction extends AdminItem {
  moderator_id: string;
  target_type: string;
  target_id: string;
  action: string;
  reason: string | null;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface PlatformSetting {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalPrograms: number;
  totalReports: number;
  pendingReports: number;
  totalPayoutsPending: number;
  openDisputes: number;
}

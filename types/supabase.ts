import type {
  Profile,
  UserRoleRow,
  ResearcherProfile,
  CompanyProfile,
  CompanyMember,
  CompanyInvitation,
  CompanyVerification,
  ResearcherReputation,
  ResearcherStats,
  Badge,
  ResearcherBadge,
} from './user';
import type {
  Program,
  ProgramAsset,
  ProgramRule,
  ProgramResearcher,
  SavedProgram,
  BountyPolicy,
} from './program';
import type {
  Report,
  ReportEvent,
  ReportComment,
  ReportAttachment,
  ReportLabel,
  SeverityPolicy,
} from './report';
import type {
  Wallet,
  WalletTransaction,
  BountyAward,
  BountyPayment,
  PayoutRequest,
  PaymentMethod,
} from './wallet';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

/** One Supabase table shape (Row + permissive Insert/Update for foundation use). */
export interface SbTable<TRow> {
  Row: TRow;
  Insert: Partial<TRow>;
  Update: Partial<TRow>;
}

export interface Dispute {
  id: string;
  report_id: string;
  opened_by: string;
  reason: string;
  status: 'open' | 'under_review' | 'resolved' | 'rejected';
  resolved_by: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type:
    | 'report'
    | 'comment'
    | 'bounty'
    | 'payment'
    | 'program'
    | 'message'
    | 'system'
    | 'dispute'
    | 'badge';
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

/** Minimal Supabase Database map mirroring supabase/masrbounty.sql. */
export interface Database {
  public: {
    Tables: {
      profiles: SbTable<Profile>;
      user_roles: SbTable<UserRoleRow>;
      researcher_profiles: SbTable<ResearcherProfile>;
      company_profiles: SbTable<CompanyProfile>;
      company_members: SbTable<CompanyMember>;
      company_invitations: SbTable<CompanyInvitation>;
      company_verifications: SbTable<CompanyVerification>;
      programs: SbTable<Program>;
      program_assets: SbTable<ProgramAsset>;
      program_rules: SbTable<ProgramRule>;
      program_researchers: SbTable<ProgramResearcher>;
      saved_programs: SbTable<SavedProgram>;
      reports: SbTable<Report>;
      report_events: SbTable<ReportEvent>;
      report_comments: SbTable<ReportComment>;
      report_attachments: SbTable<ReportAttachment>;
      report_labels: SbTable<ReportLabel>;
      report_severity: SbTable<SeverityPolicy>;
      bounty_policies: SbTable<BountyPolicy>;
      bounty_awards: SbTable<BountyAward>;
      bounty_payments: SbTable<BountyPayment>;
      wallets: SbTable<Wallet>;
      wallet_transactions: SbTable<WalletTransaction>;
      payout_requests: SbTable<PayoutRequest>;
      payment_methods: SbTable<PaymentMethod>;
      disputes: SbTable<Dispute>;
      notifications: SbTable<Notification>;
      researcher_reputation: SbTable<ResearcherReputation>;
      researcher_stats: SbTable<ResearcherStats>;
      badges: SbTable<Badge>;
      researcher_badges: SbTable<ResearcherBadge>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: 'researcher' | 'company' | 'moderator' | 'admin';
      company_member_role: 'owner' | 'admin' | 'triager' | 'viewer';
      program_status: 'draft' | 'pending_review' | 'active' | 'paused' | 'closed';
      program_visibility: 'public' | 'private';
      asset_type: 'web' | 'api' | 'mobile' | 'network' | 'other';
      report_status:
        | 'draft'
        | 'submitted'
        | 'triaged'
        | 'informative'
        | 'duplicate'
        | 'not_applicable'
        | 'accepted'
        | 'resolved'
        | 'closed';
      severity_level: 'informational' | 'low' | 'medium' | 'high' | 'critical';
      bounty_status: 'pending' | 'approved' | 'rejected' | 'paid';
      payment_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
      payout_status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
      txn_type: 'bounty' | 'payout' | 'refund' | 'adjustment';
      dispute_status: 'open' | 'under_review' | 'resolved' | 'rejected';
      ticket_status: 'open' | 'in_progress' | 'resolved' | 'closed';
      verification_status: 'pending' | 'approved' | 'rejected';
      audit_action:
        | 'create'
        | 'update'
        | 'delete'
        | 'login'
        | 'logout'
        | 'award'
        | 'payout'
        | 'moderate'
        | 'verify';
    };
  };
}

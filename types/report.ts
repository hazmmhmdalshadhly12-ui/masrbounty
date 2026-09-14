import { z } from 'zod';
import { reportSchema } from '@/schemas/report';

export type ReportInput = z.infer<typeof reportSchema>;

export type ReportStatus =
  | 'draft'
  | 'submitted'
  | 'triaged'
  | 'informative'
  | 'duplicate'
  | 'not_applicable'
  | 'accepted'
  | 'resolved'
  | 'closed';

export type SeverityLevel = 'informational' | 'low' | 'medium' | 'high' | 'critical';

export interface Report {
  id: string;
  report_number: string;
  program_id: string;
  researcher_id: string;
  asset_id: string | null;
  title: string;
  summary: string;
  vulnerability_type: string;
  severity: SeverityLevel;
  affected_asset: string;
  description: string;
  impact: string;
  reproduction_steps: string;
  remediation: string | null;
  status: ReportStatus;
  bounty_amount: number;
  cvss_score: number | null;
  submitted_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportEvent {
  id: string;
  report_id: string;
  actor_id: string | null;
  from_status: ReportStatus | null;
  to_status: ReportStatus | null;
  note: string | null;
  created_at: string;
}

export interface ReportComment {
  id: string;
  report_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportAttachment {
  id: string;
  report_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface ReportLabel {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ReportDuplicate {
  id: string;
  report_id: string;
  duplicate_of: string;
  marked_by: string | null;
  created_at: string;
}

export interface ReportAssignee {
  id: string;
  report_id: string;
  user_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface SeverityPolicy {
  id: string;
  code: SeverityLevel;
  label_ar: string;
  label_en: string;
  min_bounty: number;
  max_bounty: number;
  reputation_points: number;
  created_at: string;
}

export interface ReportOverview {
  id: string;
  report_number: string;
  title: string;
  status: ReportStatus;
  severity: SeverityLevel;
  bounty_amount: number;
  created_at: string;
  program_name: string;
  program_slug: string;
  company_name: string;
  researcher_name: string;
}

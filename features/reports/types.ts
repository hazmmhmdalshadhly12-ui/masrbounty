export interface ReportsItem {
  id: string;
  created_at: string;
}

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

export interface Report extends ReportsItem {
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
  updated_at: string;
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

export interface ReportEvent {
  id: string;
  report_id: string;
  actor_id: string | null;
  from_status: ReportStatus | null;
  to_status: ReportStatus | null;
  note: string | null;
  created_at: string;
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

export interface ProgramsItem {
  id: string;
  created_at: string;
}

export type ProgramStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'closed';
export type ProgramVisibility = 'public' | 'private';
export type AssetType = 'web' | 'api' | 'mobile' | 'network' | 'other';

export interface Program extends ProgramsItem {
  company_id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  visibility: ProgramVisibility;
  status: ProgramStatus;
  scope: string;
  out_of_scope: string | null;
  safe_harbor: string | null;
  contact_email: string | null;
  response_sla_hours: number | null;
  created_by: string | null;
  updated_at: string;
}

export interface ProgramAsset {
  id: string;
  program_id: string;
  type: AssetType;
  value: string;
  description: string | null;
  created_at: string;
}

export interface ProgramRule {
  id: string;
  program_id: string;
  title: string;
  content: string;
  sort_order: number;
  created_at: string;
}

export interface BountyPolicy {
  id: string;
  program_id: string;
  severity: 'informational' | 'low' | 'medium' | 'high' | 'critical';
  min_amount: number;
  max_amount: number;
}

export interface ProgramStats {
  program_id: string;
  name: string;
  slug: string;
  status: ProgramStatus;
  total_reports: number;
  new_reports: number;
  resolved_reports: number;
  total_bounty: number;
}

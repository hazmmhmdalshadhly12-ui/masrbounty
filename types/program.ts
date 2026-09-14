export type ProgramStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'closed';
export type ProgramVisibility = 'public' | 'private';
export type AssetType = 'web' | 'api' | 'mobile' | 'network' | 'other';
export type ProgramInviteStatus = 'pending' | 'accepted' | 'declined';

export interface Program {
  id: string;
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
  created_at: string;
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

export interface ProgramResearcher {
  id: string;
  program_id: string;
  researcher_id: string;
  status: ProgramInviteStatus;
  invited_at: string;
}

export interface SavedProgram {
  id: string;
  researcher_id: string;
  program_id: string;
  created_at: string;
}

export interface ResearcherProgramActivity {
  id: string;
  researcher_id: string;
  program_id: string;
  last_viewed_at: string | null;
  reports_count: number;
  created_at: string;
}

export interface BountyPolicy {
  id: string;
  program_id: string;
  severity: import('./report').SeverityLevel;
  min_amount: number;
  max_amount: number;
}

export interface ProgramUpdate {
  id: string;
  program_id: string;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
}

export interface ProgramWithCompany extends Program {
  company: { id: string; name: string; slug: string; logo_url: string | null; is_verified: boolean };
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

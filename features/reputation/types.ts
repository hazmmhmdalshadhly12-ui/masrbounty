export interface ReputationItem {
  id: string;
  created_at: string;
}

export interface ResearcherReputation extends ReputationItem {
  researcher_id: string;
  score: number;
  rank: number | null;
  updated_at: string;
}

export interface ResearcherStats {
  id: string;
  researcher_id: string;
  total_reports: number;
  accepted_reports: number;
  resolved_reports: number;
  duplicate_reports: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_earned: number;
  updated_at: string;
}

export interface ReputationWithStats extends ResearcherReputation {
  stats: ResearcherStats | null;
  display_name?: string;
}

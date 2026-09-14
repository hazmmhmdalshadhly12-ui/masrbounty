export interface LeaderboardItem {
  id: string;
  created_at: string;
}

export interface LeaderboardEntry {
  researcher_id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  accepted_reports: number;
  resolved_reports: number;
  total_earned: number;
  rank: number;
}

export type LeaderboardPeriod = 'global' | 'monthly';

export interface LeaderboardSnapshot {
  id: string;
  period: LeaderboardPeriod;
  snapshot_date: string;
  researcher_id: string;
  score: number;
  rank: number;
  created_at: string;
}

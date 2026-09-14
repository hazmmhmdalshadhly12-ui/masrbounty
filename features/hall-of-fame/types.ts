export interface HallOfFameItem {
  id: string;
  created_at: string;
}

export interface HallOfFameEntry {
  id: string;
  researcher_id: string;
  company_id: string | null;
  program_id: string | null;
  achievement: string;
  display_name: string;
  recognized_at: string;
  created_at: string;
  company_name?: string | null;
  program_name?: string | null;
}

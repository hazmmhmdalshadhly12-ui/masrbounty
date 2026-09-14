export interface BadgesItem {
  id: string;
  created_at: string;
}

export interface Badge extends BadgesItem {
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon: string | null;
}

export interface ResearcherBadge {
  id: string;
  researcher_id: string;
  badge_id: string;
  awarded_at: string;
  badge?: Badge;
}

export interface Achievement {
  id: string;
  researcher_id: string;
  title: string;
  description: string | null;
  points: number;
  created_at: string;
}

export interface SearchItem {
  id: string;
  created_at: string;
}

export type SearchScope = 'programs' | 'reports' | 'researchers' | 'all';

export interface SearchFilters {
  query: string;
  scope: SearchScope;
  severity?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ProgramHit {
  kind: 'program';
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  created_at: string;
}

export interface ReportHit {
  kind: 'report';
  id: string;
  report_number: string;
  title: string;
  status: string;
  severity: string;
  created_at: string;
}

export interface ResearcherHit {
  kind: 'researcher';
  id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
}

export type SearchHit = ProgramHit | ReportHit | ResearcherHit;

export interface SearchResult {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
}

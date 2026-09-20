import type { Locale, Role, ThemeMode } from './index';

export type UserRole = Role;
export type CompanyMemberRole = 'owner' | 'admin' | 'triager' | 'analyst' | 'finance' | 'viewer';
export type VerificationKind = 'email' | 'phone' | 'identity';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  locale: Locale;
  theme: ThemeMode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: UserRole;
  granted_by: string | null;
  created_at: string;
}

export interface ResearcherProfile {
  id: string;
  user_id: string;
  display_name: string;
  country: string | null;
  website: string | null;
  github: string | null;
  twitter: string | null;
  linkedin: string | null;
  skills: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyProfile {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  country: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyMemberRole;
  invited_by: string | null;
  joined_at: string;
}

export interface CompanyInvitation {
  id: string;
  company_id: string;
  email: string;
  role: CompanyMemberRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export type CompanyVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface CompanyVerification {
  id: string;
  company_id: string;
  document_url: string | null;
  status: CompanyVerificationStatus;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearcherReputation {
  id: string;
  researcher_id: string;
  score: number;
  rank: number | null;
  created_at: string;
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

export interface Badge {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon: string | null;
  created_at: string;
}

export interface ResearcherBadge {
  id: string;
  researcher_id: string;
  badge_id: string;
  awarded_at: string;
}

export interface ResearcherWithProfile extends ResearcherProfile {
  profile: Pick<Profile, 'username' | 'avatar_url' | 'created_at'>;
  reputation: Pick<ResearcherReputation, 'score'> | null;
  stats: ResearcherStats | null;
}

/** Minimal legacy shape kept for backwards compatibility. */
export interface Researcher {
  id: string;
  display_name: string;
}

/** Minimal legacy shape kept for backwards compatibility. */
export interface Company {
  id: string;
  name: string;
  slug: string;
}

export interface CompanyItem {
  id: string;
  created_at: string;
}

export type CompanyMemberRole = 'owner' | 'admin' | 'triager' | 'viewer';

export interface CompanyProfile extends CompanyItem {
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  country: string | null;
  is_verified: boolean;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyMemberRole;
  invited_by: string | null;
  joined_at: string;
  profile?: { username: string; avatar_url: string | null };
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

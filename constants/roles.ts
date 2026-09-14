import type { Locale } from '@/types/index';

export const ROLES = ['researcher', 'company', 'moderator', 'admin'] as const;
export const MEMBER_ROLES = ['owner', 'admin', 'triager', 'viewer'] as const;
export const STAFF_ROLES = ['admin', 'moderator'] as const;

export type UserRole = (typeof ROLES)[number];
export type CompanyMemberRole = (typeof MEMBER_ROLES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const DEFAULT_ROLE: UserRole = 'researcher';

export const ROLE_LABELS: Record<UserRole, { ar: string; en: string }> = {
  researcher: { ar: 'باحث', en: 'Researcher' },
  company: { ar: 'شركة', en: 'Company' },
  moderator: { ar: 'مشرف', en: 'Moderator' },
  admin: { ar: 'مدير', en: 'Admin' },
};

export const MEMBER_ROLE_LABELS: Record<CompanyMemberRole, { ar: string; en: string }> = {
  owner: { ar: 'مالك', en: 'Owner' },
  admin: { ar: 'مدير', en: 'Admin' },
  triager: { ar: 'فارز', en: 'Triager' },
  viewer: { ar: 'مشاهِد', en: 'Viewer' },
};

export function isRole(value: string): value is UserRole {
  return (ROLES as readonly string[]).includes(value);
}

export function isMemberRole(value: string): value is CompanyMemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

export function isStaff(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'moderator';
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === 'admin';
}

export function hasRole(mine: readonly string[], ...wanted: UserRole[]): boolean {
  return wanted.some((r) => mine.includes(r));
}

export function canTriage(memberRole: CompanyMemberRole | null | undefined): boolean {
  return memberRole === 'owner' || memberRole === 'admin' || memberRole === 'triager';
}

export function roleLabel(role: UserRole, locale: Locale = 'ar'): string {
  return ROLE_LABELS[role][locale];
}

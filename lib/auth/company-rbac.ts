import type { SupabaseClient } from '@supabase/supabase-js';

export const ROLE_HIERARCHY = {
  owner: 100,
  admin: 80,
  triager: 50,
  analyst: 40,
  finance: 30,
  viewer: 10,
} as const;

export type CompanyRole = keyof typeof ROLE_HIERARCHY;

export type Permission =
  | 'manage_team'
  | 'manage_programs'
  | 'triage_reports'
  | 'view_reports'
  | 'manage_payments'
  | 'view_payments'
  | 'manage_members'
  | 'view_analytics';

export const PERMISSIONS: Record<Permission, readonly CompanyRole[]> = {
  manage_team: ['owner', 'admin'],
  manage_programs: ['owner', 'admin'],
  triage_reports: ['owner', 'admin', 'triager', 'analyst'],
  view_reports: ['owner', 'admin', 'triager', 'analyst', 'finance', 'viewer'],
  manage_payments: ['owner', 'admin', 'finance'],
  view_payments: ['owner', 'admin', 'finance', 'viewer'],
  manage_members: ['owner', 'admin'],
  view_analytics: ['owner', 'admin', 'triager', 'analyst', 'finance', 'viewer'],
} as const;

function isCompanyRole(v: string): v is CompanyRole {
  return v in ROLE_HIERARCHY;
}

/**
 * Resolve the caller's role inside a company.
 * Owner is derived from company_profiles.owner_id (highest privilege, 100).
 * Otherwise query company_members.role.
 * Returns null if not a member.
 */
export async function getCompanyRole(
  supabase: SupabaseClient,
  companyId: string,
  userId: string
): Promise<CompanyRole | null> {
  const { data: company } = await supabase
    .from('company_profiles')
    .select('owner_id')
    .eq('id', companyId)
    .maybeSingle();

  if (company && (company as { owner_id: string }).owner_id === userId) {
    return 'owner';
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle();

  const raw = (membership as { role: string } | null)?.role;
  if (raw && isCompanyRole(raw)) return raw;
  return null;
}

/** Check if a user has a specific permission inside a company. */
export async function hasPermission(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  permission: Permission
): Promise<boolean> {
  const role = await getCompanyRole(supabase, companyId, userId);
  if (!role) return false;
  const allowed = PERMISSIONS[permission];
  return (allowed as readonly string[]).includes(role);
}

/**
 * Guard that throws when the caller lacks permission.
 * Arabic error to match app locale.
 */
export async function requirePermission(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  permission: Permission
): Promise<void> {
  const ok = await hasPermission(supabase, companyId, userId, permission);
  if (!ok) {
    throw new Error('ليس لديك صلاحية للقيام بهذا الإجراء');
  }
}

/** Get numeric rank for hierarchy comparisons. */
export function getRoleRank(role: CompanyRole): number {
  return ROLE_HIERARCHY[role];
}

/** Returns true if roleA outranks roleB. */
export function outranks(roleA: CompanyRole, roleB: CompanyRole): boolean {
  return ROLE_HIERARCHY[roleA] > ROLE_HIERARCHY[roleB];
}

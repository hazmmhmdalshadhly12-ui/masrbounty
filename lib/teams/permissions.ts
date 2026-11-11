/**
 * Teams & Memberships — permission system (pure, unit-testable).
 * Mirrors the SQL matrices in migrations 28/29: any change here MUST be
 * applied to fn_team_permission / fn_company_permission as well.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Catalogs
// ─────────────────────────────────────────────────────────────────────────────

export const COMPANY_PERMISSIONS = [
  'company.view_dashboard',
  'company.manage_profile',
  'company.manage_members',
  'program.create',
  'program.edit',
  'program.manage',
  'report.view',
  'report.triage',
  'report.change_status',
  'report.request_information',
  'report.comment',
  'report.manage',
  'analytics.view',
] as const;
export type CompanyPermission = (typeof COMPANY_PERMISSIONS)[number];

export const RESEARCHER_TEAM_PERMISSIONS = [
  'team.view',
  'team.manage_members',
  'team.invite_members',
  'team.manage_settings',
  'researcher.view_team_reports',
  'researcher.submit_reports',
  'researcher.manage_team_work',
] as const;
export type TeamPermission = (typeof RESEARCHER_TEAM_PERMISSIONS)[number];

export type TeamMemberRole = 'owner' | 'lead' | 'member';
export const TEAM_MEMBER_ROLES: readonly TeamMemberRole[] = ['owner', 'lead', 'member'];

// ─────────────────────────────────────────────────────────────────────────────
// Role → default permission matrices (owner bypasses via isOwner)
// ─────────────────────────────────────────────────────────────────────────────

export const COMPANY_ROLE_DEFAULTS: Record<string, readonly CompanyPermission[]> = {
  owner: [],
  admin: [
    'company.view_dashboard',
    'company.manage_profile',
    'company.manage_members',
    'program.create',
    'program.edit',
    'program.manage',
    'report.view',
    'report.triage',
    'report.change_status',
    'report.request_information',
    'report.comment',
    'report.manage',
    'analytics.view',
  ],
  // Security Manager
  analyst: [
    'company.view_dashboard',
    'report.view',
    'report.triage',
    'report.change_status',
    'report.request_information',
    'report.comment',
    'analytics.view',
  ],
  triager: [
    'company.view_dashboard',
    'report.view',
    'report.triage',
    'report.change_status',
    'report.request_information',
    'report.comment',
  ],
  finance: ['company.view_dashboard', 'analytics.view'],
  viewer: ['company.view_dashboard', 'report.view', 'analytics.view'],
};

export const TEAM_ROLE_DEFAULTS: Record<string, readonly TeamPermission[]> = {
  lead: [
    'team.view',
    'team.invite_members',
    'researcher.view_team_reports',
    'researcher.submit_reports',
    'researcher.manage_team_work',
  ],
  member: ['team.view', 'researcher.view_team_reports', 'researcher.submit_reports'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Overrides + effective permissions
// ─────────────────────────────────────────────────────────────────────────────

export interface PermissionOverrides {
  grant: string[];
  revoke: string[];
}

export const EMPTY_OVERRIDES: PermissionOverrides = { grant: [], revoke: [] };

/** Safely parse the permissions JSONB column (any shape → clean overrides). */
export function parseOverrides(raw: unknown): PermissionOverrides {
  if (!raw || typeof raw !== 'object') return { grant: [], revoke: [] };
  const obj = raw as Record<string, unknown>;
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return { grant: list(obj.grant), revoke: list(obj.revoke) };
}

export function serializeOverrides(o: PermissionOverrides): { grant: string[]; revoke: string[] } {
  return {
    grant: [...new Set(o.grant)],
    revoke: [...new Set(o.revoke)],
  };
}

export interface PermissionSubject {
  role: string;
  isOwner: boolean;
  overrides?: PermissionOverrides;
}

/** Every permission the platform knows — overrides can never grant outside it. */
const KNOWN_PERMISSIONS: ReadonlySet<string> = new Set<string>([
  ...COMPANY_PERMISSIONS,
  ...RESEARCHER_TEAM_PERMISSIONS,
]);

export function isKnownPermission(permission: string): boolean {
  return KNOWN_PERMISSIONS.has(permission);
}

/**
 * Effective permission check: owner bypass → non-catalog always false →
 * revoked → granted → role defaults.
 */
export function hasPermission(subject: PermissionSubject, permission: string): boolean {
  if (subject.isOwner) return true;
  if (!isKnownPermission(permission)) return false;
  const o = subject.overrides ?? EMPTY_OVERRIDES;
  if (o.revoke.includes(permission)) return false;
  if (o.grant.includes(permission)) return true;
  const defaults =
    (COMPANY_ROLE_DEFAULTS as Record<string, readonly string[] | undefined>)[subject.role] ??
    (TEAM_ROLE_DEFAULTS as Record<string, readonly string[] | undefined>)[subject.role] ??
    [];
  return defaults.includes(permission);
}

export function effectivePermissions(subject: PermissionSubject, catalog: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const p of catalog) if (hasPermission(subject, p)) out.add(p);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-escalation rules (shared by actions + UI)
// ─────────────────────────────────────────────────────────────────────────────

export const COMPANY_ROLE_RANK: Record<string, number> = {
  owner: 100,
  admin: 80,
  analyst: 60,
  triager: 50,
  finance: 40,
  viewer: 10,
};

export const TEAM_ROLE_RANK: Record<TeamMemberRole, number> = {
  owner: 100,
  lead: 60,
  member: 10,
};

/** Can the actor grant/keep `targetRole` on another member? */
export function canAssignCompanyRole(actor: PermissionSubject, targetRole: string): boolean {
  if (actor.isOwner) return true;
  const rank = (COMPANY_ROLE_RANK as Record<string, number>)[actor.role] ?? -1;
  const targetRank = (COMPANY_ROLE_RANK as Record<string, number>)[targetRole] ?? Infinity;
  return rank > targetRank;
}

/** Only the team owner promotes to lead. */
export function canAssignTeamRole(
  actor: PermissionSubject,
  targetRole: Exclude<TeamMemberRole, 'owner'>
): boolean {
  if (actor.isOwner) return true;
  return false;
}

/** A manager may only grant permissions they themselves hold. */
export function canGrantPermissions(
  actor: PermissionSubject,
  catalog: readonly string[],
  grants: readonly string[]
): { ok: boolean; missing: string[] } {
  if (actor.isOwner) return { ok: true, missing: [] };
  const mine = effectivePermissions(actor, catalog);
  const missing = grants.filter((g) => !mine.has(g) || !catalog.includes(g));
  return { ok: missing.length === 0, missing };
}

/**
 * Full guard for editing another member (role + permission overrides).
 * `self` = target is the actor themself.
 */
export function canEditMember(
  actor: PermissionSubject,
  target: { role: string; self: boolean },
  companyMode: boolean
): { ok: boolean; reason?: string } {
  if (actor.isOwner) return { ok: true };
  const required = companyMode ? 'company.manage_members' : 'team.manage_members';
  if (!hasPermission(actor, required)) {
    return { ok: false, reason: 'لا تملك صلاحية إدارة الأعضاء' };
  }
  if (target.role === 'owner') return { ok: false, reason: 'عضوية المالك غير قابلة للتعديل' };
  if (target.self) return { ok: false, reason: 'لا يمكنك تعديل عضويتك بنفسك' };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy aliases — keeps existing company-rbac call sites working while the
// new granular catalog rolls out.
// ─────────────────────────────────────────────────────────────────────────────

export const COMPANY_LEGACY_PERMISSION_MAP: Record<string, CompanyPermission> = {
  manage_team: 'company.manage_members',
  manage_programs: 'program.manage',
  triage_reports: 'report.triage',
  view_reports: 'report.view',
  manage_payments: 'report.manage',
  view_payments: 'report.view',
  manage_members: 'company.manage_members',
  view_analytics: 'analytics.view',
};

export function resolvePermissionName(permission: string): string {
  return COMPANY_LEGACY_PERMISSION_MAP[permission] ?? permission;
}

// ─────────────────────────────────────────────────────────────────────────────
// Invitation state machine
// ─────────────────────────────────────────────────────────────────────────────

export const INVITATION_STATUSES = ['pending', 'accepted', 'rejected', 'revoked', 'expired'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

const INVITATION_TRANSITIONS: Record<InvitationStatus, readonly InvitationStatus[]> = {
  pending: ['accepted', 'rejected', 'revoked', 'expired'],
  accepted: [],
  rejected: ['pending'], // resend revives a rejected invite
  revoked: ['pending'], // resend revives a revoked invite
  expired: ['pending'], // resend revives an expired invite
};

export function canTransitionInvitation(from: InvitationStatus, to: InvitationStatus): boolean {
  return (INVITATION_TRANSITIONS[from] ?? []).includes(to);
}

export interface InvitationLike {
  status: InvitationStatus | string;
  expires_at: string | Date;
}

/** Pending + not expired = actionable by the invitee. */
export function isInvitationAcceptable(inv: InvitationLike): boolean {
  if (inv.status !== 'pending') return false;
  return new Date(inv.expires_at).getTime() > Date.now();
}

export function invitationStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'معلّقة',
    accepted: 'مقبولة',
    rejected: 'مرفوضة',
    revoked: 'ملغاة',
    expired: 'منتهية',
  };
  return map[status] ?? status;
}

// ─────────────────────────────────────────────────────────────────────────────
// Labels
// ─────────────────────────────────────────────────────────────────────────────

export const COMPANY_PERMISSION_LABELS: Record<CompanyPermission, string> = {
  'company.view_dashboard': 'عرض لوحة الشركة',
  'company.manage_profile': 'إدارة ملف الشركة',
  'company.manage_members': 'إدارة الأعضاء',
  'program.create': 'إنشاء برامج',
  'program.edit': 'تعديل البرامج',
  'program.manage': 'إدارة البرامج',
  'report.view': 'عرض التقارير',
  'report.triage': 'فرز التقارير',
  'report.change_status': 'تغيير حالة التقارير',
  'report.request_information': 'طلب معلومات من الباحث',
  'report.comment': 'التعليق على التقارير',
  'report.manage': 'إدارة التقارير والمدفوعات',
  'analytics.view': 'عرض التحليلات',
};

export const TEAM_PERMISSION_LABELS: Record<TeamPermission, string> = {
  'team.view': 'عرض الفريق',
  'team.manage_members': 'إدارة الأعضاء',
  'team.invite_members': 'دعوة أعضاء',
  'team.manage_settings': 'إدارة إعدادات الفريق',
  'researcher.view_team_reports': 'عرض تقارير الفريق',
  'researcher.submit_reports': 'إرسال تقارير باسم الفريق',
  'researcher.manage_team_work': 'إدارة عمل الفريق',
};

export const TEAM_ROLE_LABELS: Record<TeamMemberRole, string> = {
  owner: 'قائد الفريق',
  lead: 'نائب القائد',
  member: 'عضو',
};

export const COMPANY_ROLE_LABELS_AR: Record<string, string> = {
  owner: 'مالك الشركة',
  admin: 'مسؤول إدارة',
  analyst: 'مدير أمني (Security Manager)',
  triager: 'فارز تقارير (Triager)',
  finance: 'مالية',
  viewer: 'مشاهِد (Viewer)',
};

export const PROGRAM_MEMBER_ROLES = ['manager', 'triager', 'viewer'] as const;
export type ProgramMemberRole = (typeof PROGRAM_MEMBER_ROLES)[number];
export const PROGRAM_ROLE_LABELS: Record<ProgramMemberRole, string> = {
  manager: 'مدير البرنامج',
  triager: 'فارز تقارير البرنامج',
  viewer: 'مشاهِد',
};

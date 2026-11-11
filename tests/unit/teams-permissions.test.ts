/**
 * Teams & Memberships — permission engine (pure functions).
 * Covers prompt scenarios: 8 (الشركة تحدد صلاحيات العضو), 9 (العضو لا يستطيع
 * تجاوز صلاحياته), plus the role→permission matrix and anti-escalation rules.
 * These MUST mirror fn_team_permission / fn_company_permission in migrations 28/29.
 */
import { readFileSync } from 'fs';
import {
  COMPANY_PERMISSIONS,
  RESEARCHER_TEAM_PERMISSIONS,
  COMPANY_ROLE_DEFAULTS,
  TEAM_ROLE_DEFAULTS,
  hasPermission,
  effectivePermissions,
  parseOverrides,
  serializeOverrides,
  canAssignCompanyRole,
  canAssignTeamRole,
  canGrantPermissions,
  canEditMember,
  COMPANY_LEGACY_PERMISSION_MAP,
  resolvePermissionName,
  canTransitionInvitation,
  isInvitationAcceptable,
  invitationStatusLabel,
} from '@/lib/teams/permissions';

const sub = (role: string, overrides?: { grant?: string[]; revoke?: string[] }) => ({
  role,
  isOwner: false,
  overrides: overrides ? { grant: overrides.grant ?? [], revoke: overrides.revoke ?? [] } : undefined,
});

describe('company role → default permission matrix', () => {
  test('owner bypasses every check via isOwner', () => {
    for (const p of COMPANY_PERMISSIONS) {
      expect(hasPermission({ role: 'owner', isOwner: true }, p)).toBe(true);
    }
    expect(hasPermission({ role: 'owner', isOwner: true }, 'anything.not.in.catalog')).toBe(true);
  });

  test('admin holds management + program + triage + finance permissions', () => {
    expect(hasPermission(sub('admin'), 'company.manage_members')).toBe(true);
    expect(hasPermission(sub('admin'), 'program.manage')).toBe(true);
    expect(hasPermission(sub('admin'), 'report.triage')).toBe(true);
    expect(hasPermission(sub('admin'), 'report.manage')).toBe(true);
    expect(hasPermission(sub('admin'), 'company.create_something_new')).toBe(false);
  });

  test('Security Manager (analyst) triages and views analytics but cannot manage members', () => {
    expect(hasPermission(sub('analyst'), 'report.triage')).toBe(true);
    expect(hasPermission(sub('analyst'), 'report.change_status')).toBe(true);
    expect(hasPermission(sub('analyst'), 'report.request_information')).toBe(true);
    expect(hasPermission(sub('analyst'), 'analytics.view')).toBe(true);
    expect(hasPermission(sub('analyst'), 'company.manage_members')).toBe(false);
    expect(hasPermission(sub('analyst'), 'program.manage')).toBe(false);
  });

  test('triager triages but cannot manage programs or members', () => {
    expect(hasPermission(sub('triager'), 'report.triage')).toBe(true);
    expect(hasPermission(sub('triager'), 'program.manage')).toBe(false);
    expect(hasPermission(sub('triager'), 'company.manage_members')).toBe(false);
    expect(hasPermission(sub('triager'), 'report.manage')).toBe(false);
  });

  test('viewer is read-only', () => {
    expect(hasPermission(sub('viewer'), 'report.view')).toBe(true);
    expect(hasPermission(sub('viewer'), 'company.view_dashboard')).toBe(true);
    expect(hasPermission(sub('viewer'), 'report.triage')).toBe(false);
    expect(hasPermission(sub('viewer'), 'report.change_status')).toBe(false);
  });

  test('unknown role has no permissions at all', () => {
    for (const p of COMPANY_PERMISSIONS) expect(hasPermission(sub('ghost'), p)).toBe(false);
  });
});

describe('per-member permission overrides', () => {
  test('grant adds a permission the role does not have by default', () => {
    const s = sub('viewer', { grant: ['report.triage'] });
    expect(hasPermission(s, 'report.triage')).toBe(true);
    expect(hasPermission(s, 'company.manage_members')).toBe(false);
  });

  test('revoke removes a role default', () => {
    const s = sub('analyst', { revoke: ['analytics.view'] });
    expect(hasPermission(s, 'analytics.view')).toBe(false);
    expect(hasPermission(s, 'report.triage')).toBe(true);
  });

  test('revoke wins over grant', () => {
    const s = sub('viewer', { grant: ['report.view'], revoke: ['report.view'] });
    expect(hasPermission(s, 'report.view')).toBe(false);
  });

  test('overrides never bypass isOwner=false on non-catalog permissions', () => {
    const s = sub('viewer', { grant: ['platform.admin'] });
    expect(hasPermission(s, 'platform.admin')).toBe(false);
  });

  test('parseOverrides tolerates corrupt JSONB shapes', () => {
    expect(parseOverrides(null)).toEqual({ grant: [], revoke: [] });
    expect(parseOverrides('garbage')).toEqual({ grant: [], revoke: [] });
    expect(parseOverrides({ grant: 'report.view', revoke: 42 })).toEqual({ grant: [], revoke: [] });
    expect(parseOverrides({ grant: ['report.view', 5, null], revoke: ['x'] })).toEqual({
      grant: ['report.view'],
      revoke: ['x'],
    });
    expect(serializeOverrides({ grant: ['a', 'a', 'b'], revoke: [] })).toEqual({ grant: ['a', 'b'], revoke: [] });
  });
});

describe('anti-escalation', () => {
  test('canAssignCompanyRole: admin cannot create an owner/admin, viewer cannot create anything', () => {
    expect(canAssignCompanyRole(sub('admin'), 'viewer')).toBe(true);
    expect(canAssignCompanyRole(sub('admin'), 'triager')).toBe(true);
    expect(canAssignCompanyRole(sub('admin'), 'admin')).toBe(false);
    expect(canAssignCompanyRole(sub('admin'), 'owner')).toBe(false);
    expect(canAssignCompanyRole(sub('viewer'), 'viewer')).toBe(false);
    expect(canAssignCompanyRole({ role: 'owner', isOwner: true }, 'admin')).toBe(true);
  });

  test('canAssignTeamRole: only the team owner promotes to lead', () => {
    expect(canAssignTeamRole({ role: 'owner', isOwner: true }, 'lead')).toBe(true);
    expect(canAssignTeamRole(sub('lead'), 'lead')).toBe(false);
    expect(canAssignTeamRole(sub('member'), 'member')).toBe(false);
  });

  test('canGrantPermissions: a manager can only grant what they themselves hold', () => {
    const viewerGrantingTriage = canGrantPermissions(sub('viewer'), COMPANY_PERMISSIONS, ['report.triage']);
    expect(viewerGrantingTriage.ok).toBe(false);
    expect(viewerGrantingTriage.missing).toEqual(['report.triage']);

    const adminGrantingTriage = canGrantPermissions(sub('admin'), COMPANY_PERMISSIONS, ['report.triage', 'analytics.view']);
    expect(adminGrantingTriage.ok).toBe(true);
    expect(adminGrantingTriage.missing).toEqual([]);

    const ownerCanGrantAnything = canGrantPermissions(
      { role: 'owner', isOwner: true },
      COMPANY_PERMISSIONS,
      COMPANY_PERMISSIONS
    );
    expect(ownerCanGrantAnything.ok).toBe(true);
  });

  test('canGrantPermissions rejects permissions outside the catalog', () => {
    const r = canGrantPermissions(sub('admin'), COMPANY_PERMISSIONS, ['hacker.permission']);
    expect(r.ok).toBe(false);
  });

  test('canEditMember: owner row immutable, self-edit forbidden for non-owners, managers need manage_members', () => {
    expect(canEditMember({ role: 'owner', isOwner: true }, { role: 'viewer', self: false }, true).ok).toBe(true);
    expect(canEditMember(sub('admin'), { role: 'owner', self: false }, true).ok).toBe(false);
    expect(canEditMember(sub('admin'), { role: 'viewer', self: true }, true).ok).toBe(false);
    expect(canEditMember(sub('viewer'), { role: 'viewer', self: false }, true).ok).toBe(false);
    expect(canEditMember(sub('admin'), { role: 'viewer', self: false }, true).ok).toBe(true);
    // team mode requires team.manage_members
    expect(canEditMember(sub('lead'), { role: 'member', self: false }, false).ok).toBe(false);
  });
});

describe('researcher team defaults', () => {
  test('lead invites and manages team work but cannot manage members', () => {
    expect(hasPermission(sub('lead'), 'team.invite_members')).toBe(true);
    expect(hasPermission(sub('lead'), 'researcher.submit_reports')).toBe(true);
    expect(hasPermission(sub('lead'), 'researcher.manage_team_work')).toBe(true);
    expect(hasPermission(sub('lead'), 'team.manage_members')).toBe(false);
    expect(hasPermission(sub('lead'), 'team.manage_settings')).toBe(false);
  });

  test('member sees the team and submits team reports, nothing more', () => {
    expect(hasPermission(sub('member'), 'team.view')).toBe(true);
    expect(hasPermission(sub('member'), 'researcher.view_team_reports')).toBe(true);
    expect(hasPermission(sub('member'), 'researcher.submit_reports')).toBe(true);
    expect(hasPermission(sub('member'), 'team.invite_members')).toBe(false);
    expect(hasPermission(sub('member'), 'team.manage_members')).toBe(false);
  });

  test('every catalog permission is present in the SQL mirrors of migration 28/29', () => {
    const m28 = readFileSync('supabase/migrations/28_teams_core.sql', 'utf8');
    const m29 = readFileSync('supabase/migrations/29_membership_permissions.sql', 'utf8');
    for (const p of RESEARCHER_TEAM_PERMISSIONS) {
      expect(m28).toContain(`'${p}'`);
    }
    for (const p of COMPANY_PERMISSIONS) {
      expect(m29).toContain(`'${p}'`);
    }
    expect(Object.keys(TEAM_ROLE_DEFAULTS).sort()).toEqual(['lead', 'member']);
  });
});

describe('legacy permission aliases keep existing call sites working', () => {
  test('all legacy names resolve to the new catalog', () => {
    for (const legacy of Object.keys(COMPANY_LEGACY_PERMISSION_MAP)) {
      expect(COMPANY_PERMISSIONS).toContain(COMPANY_LEGACY_PERMISSION_MAP[legacy]);
      expect(resolvePermissionName(legacy)).toBe(COMPANY_LEGACY_PERMISSION_MAP[legacy]);
    }
    expect(resolvePermissionName('report.triage')).toBe('report.triage');
  });

  test('legacy manage_members now grants company.manage_members through the engine', () => {
    const s = sub('viewer', { grant: [COMPANY_LEGACY_PERMISSION_MAP.manage_members] });
    expect(hasPermission(s, resolvePermissionName('manage_members'))).toBe(true);
  });
});

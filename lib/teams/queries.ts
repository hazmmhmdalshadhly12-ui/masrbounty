import { createServerClient } from '@/lib/supabase/server';
import {
  hasPermission,
  parseOverrides,
  RESEARCHER_TEAM_PERMISSIONS,
  type PermissionSubject,
  type TeamMemberRole,
} from '@/lib/teams/permissions';

export interface MyTeamSummary {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  memberCount: number;
  role: TeamMemberRole | string;
  isOwner: boolean;
  permissions: Set<string>;
}

/** Teams the user belongs to (owner or member) with their effective permissions. */
export async function getMyTeams(userId: string): Promise<MyTeamSummary[]> {
  const supabase = await createServerClient();
  const { data: memberships } = await supabase
    .from('team_members')
    .select('id,team_id,role,permissions,teams!inner(id,name,description,logo_url,owner_id)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (!memberships?.length) return [];
  const teamIds = memberships.map((m) => (m as { team_id: string }).team_id);
  const { data: counts } = await supabase
    .from('team_members')
    .select('team_id')
    .in('team_id', teamIds);
  const countBy = new Map<string, number>();
  for (const c of (counts ?? []) as { team_id: string }[]) countBy.set(c.team_id, (countBy.get(c.team_id) ?? 0) + 1);
  return memberships.map((raw) => {
    const m = raw as unknown as {
      team_id: string;
      role: string;
      permissions: unknown;
      teams: { id: string; name: string; description: string | null; logo_url: string | null; owner_id: string };
    };
    const isOwner = m.teams.owner_id === userId;
    const subject: PermissionSubject = {
      role: isOwner ? 'owner' : m.role,
      isOwner,
      overrides: parseOverrides(m.permissions),
    };
    return {
      id: m.teams.id,
      name: m.teams.name,
      description: m.teams.description,
      logo_url: m.teams.logo_url,
      memberCount: countBy.get(m.teams.id) ?? 1,
      role: isOwner ? 'owner' : m.role,
      isOwner,
      permissions: effectiveFor(subject),
    };
  });
}

function effectiveFor(subject: PermissionSubject): Set<string> {
  const out = new Set<string>();
  for (const p of RESEARCHER_TEAM_PERMISSIONS) if (hasPermission(subject, p)) out.add(p);
  return out;
}

export interface MyCompanyMembership {
  companyId: string;
  companyName: string;
  slug: string;
  role: string;
  isOwner: boolean;
  permissions: Set<string>;
  /** ready-made subject for hasPermission() checks */
  subject: PermissionSubject;
}

/** Companies the user belongs to (owner or member) — for workspace switching. */
export async function getMyCompanyMemberships(userId: string): Promise<MyCompanyMembership[]> {
  const supabase = await createServerClient();
  const { data: owned } = await supabase
    .from('company_profiles')
    .select('id,name,slug')
    .eq('owner_id', userId);
  const out: MyCompanyMembership[] = [];
  const seen = new Set<string>();
  for (const c of (owned ?? []) as { id: string; name: string; slug: string }[]) {
    out.push({
      companyId: c.id,
      companyName: c.name,
      slug: c.slug,
      role: 'owner',
      isOwner: true,
      permissions: new Set(['*']),
      subject: { role: 'owner', isOwner: true },
    });
    seen.add(c.id);
  }
  const { data: memberships } = await supabase
    .from('company_members')
    .select('role,permissions,company_profiles!inner(id,name,slug,owner_id)')
    .eq('user_id', userId);
  for (const raw of (memberships ?? []) as unknown as {
    role: string;
    permissions: unknown;
    company_profiles: { id: string; name: string; slug: string; owner_id: string };
  }[]) {
    if (seen.has(raw.company_profiles.id)) continue;
    const isOwner = raw.company_profiles.owner_id === userId;
    const subject: PermissionSubject = {
      role: isOwner ? 'owner' : raw.role,
      isOwner,
      overrides: parseOverrides(raw.permissions),
    };
    out.push({
      companyId: raw.company_profiles.id,
      companyName: raw.company_profiles.name,
      slug: raw.company_profiles.slug,
      role: isOwner ? 'owner' : raw.role,
      isOwner,
      permissions: new Set<string>(isOwner ? ['*'] : []),
      subject: {
        role: isOwner ? 'owner' : raw.role,
        isOwner,
        overrides: parseOverrides(raw.permissions),
      },
    });
  }
  return out;
}

export interface PendingInvitationRow {
  id: string;
  kind: 'researcher_team' | 'company';
  targetName: string;
  targetLogo: string | null;
  role: string;
  permissions: unknown;
  invitedByEmail: string | null;
  invitedByName: string | null;
  createdAt: string;
  expiresAt: string;
  status: string;
}

/** All pending invitations addressed to the user's email (teams + companies). */
export async function getMyPendingInvitations(email: string, userId: string): Promise<PendingInvitationRow[]> {
  const supabase = await createServerClient();
  const rows: PendingInvitationRow[] = [];
  const lowerEmail = email.toLowerCase();
  const [{ data: teamInvs }, { data: companyInvs }] = await Promise.all([
    supabase
      .from('team_invitations')
      .select('id,team_id,role,permissions,created_at,expires_at,status,email,invited_by,teams!inner(name,logo_url)')
      .or(`email.eq.${lowerEmail},invited_user_id.eq.${userId}`),
    supabase
      .from('company_invitations')
      .select('id,company_id,role,permissions,created_at,expires_at,status,email,invited_by,company_profiles!inner(name,logo_url)')
      .or(`email.eq.${lowerEmail},invited_user_id.eq.${userId}`),
  ]);
  const inviterIds = new Set<string>();
  for (const inv of [...(teamInvs ?? []), ...(companyInvs ?? [])] as { invited_by: string | null }[]) {
    if (inv.invited_by) inviterIds.add(inv.invited_by);
  }
  const inviterNames = new Map<string, string>();
  if (inviterIds.size) {
    const { data: inviters } = await supabase
      .from('profiles')
      .select('id,username,full_name')
      .in('id', [...inviterIds]);
    for (const p of (inviters ?? []) as { id: string; username: string; full_name: string | null }[]) {
      inviterNames.set(p.id, p.full_name || p.username);
    }
  }
  for (const raw of (teamInvs ?? []) as unknown as {
    id: string;
    role: string;
    permissions: unknown;
    created_at: string;
    expires_at: string;
    status: string;
    email: string;
    invited_by: string | null;
    teams: { name: string; logo_url: string | null };
  }[]) {
    rows.push({
      id: raw.id,
      kind: 'researcher_team',
      targetName: raw.teams.name,
      targetLogo: raw.teams.logo_url,
      role: raw.role,
      permissions: raw.permissions,
      invitedByEmail: raw.email,
      invitedByName: raw.invited_by ? (inviterNames.get(raw.invited_by) ?? null) : null,
      createdAt: raw.created_at,
      expiresAt: raw.expires_at,
      status: raw.status,
    });
  }
  for (const raw of (companyInvs ?? []) as unknown as {
    id: string;
    role: string;
    permissions: unknown;
    created_at: string;
    expires_at: string;
    status: string;
    email: string;
    invited_by: string | null;
    company_profiles: { name: string; logo_url: string | null };
  }[]) {
    rows.push({
      id: raw.id,
      kind: 'company',
      targetName: raw.company_profiles.name,
      targetLogo: raw.company_profiles.logo_url,
      role: raw.role,
      permissions: raw.permissions,
      invitedByEmail: raw.email,
      invitedByName: raw.invited_by ? (inviterNames.get(raw.invited_by) ?? null) : null,
      createdAt: raw.created_at,
      expiresAt: raw.expires_at,
      status: raw.status,
    });
  }
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Researcher teams where the user may submit reports as the team. */
export async function getSubmittableTeams(userId: string): Promise<{ id: string; name: string }[]> {
  const teams = await getMyTeams(userId);
  return teams
    .filter((t) => t.permissions.has('researcher.submit_reports'))
    .map((t) => ({ id: t.id, name: t.name }));
}

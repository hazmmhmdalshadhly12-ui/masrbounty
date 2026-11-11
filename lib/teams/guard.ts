import { createServerClient } from '@/lib/supabase/server';
import {
  hasPermission,
  parseOverrides,
  resolvePermissionName,
  type PermissionSubject,
} from '@/lib/teams/permissions';

export interface TeamContext {
  team: {
    id: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    owner_id: string;
    allow_join_requests: boolean;
    max_members: number;
  };
  member: { id: string; role: string; permissions: unknown } | null;
  isOwner: boolean;
  userId: string;
}

/** Load a team + the caller's membership. Returns null instead of redirecting. */
export async function getTeamContext(teamId: string, userId: string): Promise<TeamContext | null> {
  const supabase = await createServerClient();
  const { data: team } = await supabase
    .from('teams')
    .select('id,name,description,logo_url,owner_id,allow_join_requests,max_members')
    .eq('id', teamId)
    .maybeSingle();
  if (!team) return null;
  const t = team as TeamContext['team'];
  const { data: member } = await supabase
    .from('team_members')
    .select('id,role,permissions')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();
  const m = (member as TeamContext['member'] | null) ?? null;
  return { team: t, member: m, isOwner: t.owner_id === userId, userId };
}

/** Guard used by every researcher-team Server Action. Throws Arabic error. */
export async function requireTeamPermission(teamId: string, permission: string): Promise<TeamContext> {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('سجّل الدخول أولًا');
  const ctx = await getTeamContext(teamId, user.user.id);
  if (!ctx) throw new Error('الفريق غير موجود');
  if (!ctx.member && !ctx.isOwner) throw new Error('لست عضوًا في هذا الفريق');
  const subject: PermissionSubject = {
    role: ctx.member?.role ?? 'owner',
    isOwner: ctx.isOwner,
    overrides: parseOverrides(ctx.member?.permissions),
  };
  if (!hasPermission(subject, permission)) {
    throw new Error('ليس لديك صلاحية للقيام بهذا الإجراء');
  }
  return ctx;
}

export interface CompanyContext {
  companyId: string;
  companyName: string;
  role: string | null;
  isOwner: boolean;
  userId: string;
  subject: PermissionSubject;
}

/**
 * Granular company guard — role defaults + per-member overrides.
 * `permission` may be a legacy name (manage_members) or a new one
 * (company.manage_members); legacy names are resolved automatically so
 * every existing call site gains the new behavior for free.
 */
export async function requireCompanyPermission(companyId: string, permission: string): Promise<CompanyContext> {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('سجّل الدخول أولًا');
  const ctx = await getCompanyContext(companyId, user.user.id);
  if (!ctx) throw new Error('الشركة غير موجودة');
  if (!ctx.isOwner && !ctx.role) throw new Error('لست عضوًا في هذه الشركة');
  if (!hasPermission(ctx.subject, resolvePermissionName(permission))) {
    throw new Error('ليس لديك صلاحية للقيام بهذا الإجراء');
  }
  return ctx;
}

export async function getCompanyContext(companyId: string, userId: string): Promise<CompanyContext | null> {
  const supabase = await createServerClient();
  const { data: company } = await supabase
    .from('company_profiles')
    .select('id,name,owner_id')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return null;
  const c = company as { id: string; name: string; owner_id: string };
  const isOwner = c.owner_id === userId;
  let role: string | null = null;
  let overrides = { grant: [] as string[], revoke: [] as string[] };
  if (!isOwner) {
    const { data: member } = await supabase
      .from('company_members')
      .select('role,permissions')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .maybeSingle();
    const m = member as { role: string; permissions: unknown } | null;
    role = m?.role ?? null;
    overrides = parseOverrides(m?.permissions);
  }
  return {
    companyId: c.id,
    companyName: c.name,
    role: isOwner ? 'owner' : role,
    isOwner,
    userId,
    subject: { role: isOwner ? 'owner' : (role ?? ''), isOwner, overrides },
  };
}

/** Boolean variant for conditional rendering (never throws). */
export async function companyHasPermission(companyId: string, userId: string, permission: string): Promise<boolean> {
  try {
    const ctx = await getCompanyContext(companyId, userId);
    if (!ctx) return false;
    return hasPermission(ctx.subject, resolvePermissionName(permission));
  } catch {
    return false;
  }
}

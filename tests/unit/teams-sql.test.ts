/**
 * Teams & Memberships — SQL migration integrity gates.
 * If someone edits the migrations and silently drops RLS, anti-escalation or
 * the token-hash contract, these tests fail before CI ever reaches production.
 */
import { readFileSync } from 'fs';

const M28 = readFileSync('supabase/migrations/28_teams_core.sql', 'utf8');
const M29 = readFileSync('supabase/migrations/29_membership_permissions.sql', 'utf8');

describe('migration 28 — researcher teams core', () => {
  test('all five team tables exist with FKs and RLS enabled', () => {
    for (const t of ['teams', 'team_members', 'team_invitations', 'team_join_requests', 'team_activity_logs']) {
      expect(M28).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(`));
      expect(M28).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  test('foreign keys pin members/invitations to teams and profiles', () => {
    expect(M28).toContain('REFERENCES public.teams(id) ON DELETE CASCADE');
    expect(M28).toContain('REFERENCES public.profiles(id) ON DELETE CASCADE');
    expect(M28).toContain('UNIQUE(team_id, user_id)');
  });

  test('pending-invitation dedup is a partial unique index per (team, email)', () => {
    expect(M28).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_team_inv_pending ON public.team_invitations(team_id, lower(email)) WHERE status = \'pending\';'
    );
  });

  test('raw tokens are never stored — only sha256 fingerprints', () => {
    expect(M28).toContain('token_hash TEXT NOT NULL');
    expect(M28).not.toMatch(/token TEXT NOT NULL/); // no raw token column on team_invitations
    expect(M28).toContain("encode(sha256(convert_to(raw_token"); // noqa-style comment for clarity
    expect(M28).toContain('UNIQUE INDEX IF NOT EXISTS uq_team_inv_token_hash');
  });

  test('invitation expiry defaults to 7 days and statuses use the dedicated enum', () => {
    expect(M28).toContain("interval '7 days'");
    expect(M28).toContain('status invitation_status NOT NULL DEFAULT \'pending\'');
    expect(M28).toMatch(/CREATE TYPE invitation_status AS ENUM \('pending','accepted','rejected','revoked','expired'\)/);
  });

  test('permission engine SQL mirrors the TS defaults (owner bypass, lead, member)', () => {
    expect(M28).toContain("CREATE OR REPLACE FUNCTION public.fn_team_permission(p_team uuid, p_perm text, p_user uuid DEFAULT auth.uid())");
    expect(M28).toContain("IF r = 'owner' THEN RETURN true; END IF;");
    expect(M28).toContain("WHEN 'lead' THEN ARRAY['team.view','team.invite_members','researcher.view_team_reports','researcher.submit_reports','researcher.manage_team_work']");
    expect(M28).toContain("ELSE ARRAY['team.view','researcher.view_team_reports','researcher.submit_reports']");
    expect(M28).toContain("IF COALESCE(overrides->'revoke','[]'::jsonb) ? p_perm THEN RETURN false; END IF;");
    expect(M28).toContain("IF COALESCE(overrides->'grant','[]'::jsonb) ? p_perm THEN RETURN true; END IF;");
  });

  test('membership writes are locked behind security-definer RPCs (no direct INSERT/UPDATE/DELETE)', () => {
    expect(M28).toContain('REVOKE INSERT, UPDATE, DELETE ON public.team_members FROM authenticated, anon;');
    expect(M28).toContain('REVOKE INSERT, UPDATE, DELETE ON public.team_invitations FROM authenticated, anon;');
    expect(M28).toContain('REVOKE INSERT, UPDATE, DELETE ON public.team_join_requests FROM authenticated, anon;');
    expect(M28).toContain('REVOKE INSERT, UPDATE, DELETE ON public.team_activity_logs FROM authenticated, anon;');
    expect(M28).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_accept_team_invitation/);
    expect(M28).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_change_team_member/);
    expect(M28).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_remove_team_member/);
    expect(M28).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_transfer_team_ownership/);
  });

  test('anti-escalation lives in SQL: self-escalation + owner immutability guards', () => {
    expect(M28).toContain('RAISE EXCEPTION \'self-escalation is forbidden\'');
    expect(M28).toContain('RAISE EXCEPTION \'owner membership is immutable (transfer ownership instead)\'');
    expect(M28).toContain("RAISE EXCEPTION 'cannot grant a permission you do not hold: %'");
    expect(M28).toContain('trg_team_member_guard');
    expect(M28).toContain('fn_team_bootstrap'); // owner membership auto-created
  });

  test('acceptance verifies the email match inside SQL (scenario 16)', () => {
    expect(M28).toContain("IF caller_email <> lower(inv.email) AND coalesce(inv.invited_user_id::text, '') <> caller::text THEN");
    expect(M28).toContain("RAISE EXCEPTION 'invitation is addressed to a different email'");
  });

  test('expired invitations are flipped to expired on accept attempt (scenario 15)', () => {
    expect(M28).toContain("UPDATE public.team_invitations SET status = 'expired' WHERE id = inv.id;");
    expect(M28).toContain("RAISE EXCEPTION 'invitation expired'");
  });

  test('team-owned reports: additive columns only, legacy rows stay personal', () => {
    expect(M28).toContain('ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL');
    expect(M28).toContain("ADD COLUMN IF NOT EXISTS submission_scope TEXT CHECK (submission_scope IS NULL OR submission_scope IN ('personal','team'))");
    expect(M28).toContain('fn_team_permission(team_id, \'researcher.submit_reports\')'); // insert guard
    expect(M28).toContain('fn_team_permission(team_id, \'researcher.view_team_reports\')'); // team read policy
    expect(M28).toContain('DROP POLICY IF EXISTS "rep_insert" ON public.reports;');
  });

  test('join requests respect the team opt-in and capacity (scenarios 5, 11)', () => {
    expect(M28).toContain("RAISE EXCEPTION 'join requests are disabled for this team'");
    expect(M28).toContain("RAISE EXCEPTION 'team is full'");
    expect(M28).toContain('uq_team_join_pending');
  });

  test('member removal and leaving revoke access immediately (scenario 14)', () => {
    expect(M28).toMatch(/fn_remove_team_member[\s\S]*DELETE FROM public\.team_members/);
    expect(M28).toContain("'member.left'");
    expect(M28).toContain("'member.removed'");
  });

  test('activity log is append-only for regular users (audit integrity, section 11)', () => {
    expect(M28).toContain('fn_log_team_event');
    expect(M28).toContain("IF NOT public.fn_is_team_member(p_team, auth.uid())");
  });
});

describe('migration 29 — company permission layer + program members', () => {
  test('company_members gains per-member permission overrides', () => {
    expect(M29).toContain('ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT \'{"grant":[],"revoke":[]}\'::jsonb');
    expect(M29).toContain('company_permissions_shape');
  });

  test('company_invitations gain the 5 statuses + invited user + hashed tokens', () => {
    expect(M29).toContain('ADD COLUMN IF NOT EXISTS status invitation_status NOT NULL DEFAULT \'pending\'');
    expect(M29).toContain('ADD COLUMN IF NOT EXISTS invited_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL');
    expect(M29).toContain('ADD COLUMN IF NOT EXISTS token_hash TEXT');
    // legacy raw-token invites keep working via backfilled hashes
    expect(M29).toContain("SET token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex') WHERE token_hash IS NULL");
    expect(M29).toContain('uq_company_inv_pending');
  });

  test('fn_company_permission mirrors the TS matrix including granular catalog', () => {
    expect(M29).toContain('CREATE OR REPLACE FUNCTION public.fn_company_permission(p_company uuid, p_perm text, p_user uuid DEFAULT auth.uid())');
    expect(M29).toContain("'company.view_dashboard','company.manage_profile','company.manage_members'");
    expect(M29).toContain("'report.view','report.triage','report.change_status','report.request_information','report.comment','report.manage'");
    expect(M29).toContain("'program.create','program.edit','program.manage'");
    expect(M29).toContain("'analytics.view'");
  });

  test('member management policies opened to holders of company.manage_members (not just owners)', () => {
    expect(M29).toContain('fn_company_permission(company_id, \'company.manage_members\')');
    expect(M29).not.toContain('CREATE POLICY "cm_manage"');
  });

  test('self-escalation guard at SQL level for company members', () => {
    expect(M29).toContain('trg_company_member_guard');
    expect(M29).toContain('RAISE EXCEPTION \'self-escalation is forbidden\'');
    expect(M29).toContain("RAISE EXCEPTION 'only the company owner can grant the admin role'");
    expect(M29).toContain('company owner row is immutable');
  });

  test('the invitee can read their own invitations (دعواتي) but writes stay server-side', () => {
    expect(M29).toContain("lower(email) = lower(coalesce(auth.email(), '')) OR invited_user_id = auth.uid()");
    expect(M29).toContain('REVOKE INSERT, UPDATE, DELETE ON public.company_invitations FROM authenticated, anon;');
    expect(M29).toMatch(/fn_respond_company_invitation/);
    expect(M29).toMatch(/fn_revoke_company_invitation/);
    expect(M29).toMatch(/fn_resend_company_invitation/);
  });

  test('program_members: per-program assignments with role whitelist + RLS (section 9)', () => {
    expect(M29).toContain("CREATE TABLE IF NOT EXISTS public.program_members (");
    expect(M29).toContain("CHECK (program_role IN ('manager','triager','viewer'))");
    expect(M29).toContain('UNIQUE(program_id, user_id)');
    expect(M29).toContain('ALTER TABLE public.program_members ENABLE ROW LEVEL SECURITY;');
    expect(M29).toContain('REVOKE INSERT, UPDATE, DELETE ON public.program_members FROM authenticated, anon;');
    expect(M29).toMatch(/fn_assign_program_member/);
    expect(M29).toMatch(/fn_unassign_program_member/);
  });

  test('assignments require program.manage + active company membership (no auto-grant to all members)', () => {
    expect(M29).toContain("fn_company_permission(company_id, 'program.manage')");
    expect(M29).toContain("RAISE EXCEPTION 'user must be a company member first'");
  });

  test('member role enum for the platform gains "member" and notifications gain "team"', () => {
    expect(M28).toMatch(/ALTER TYPE user_role ADD VALUE 'member'/);
    expect(M28).toMatch(/ALTER TYPE notification_type ADD VALUE 'team'/);
  });
});

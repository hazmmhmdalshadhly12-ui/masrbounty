-- ============================================================================
-- Migration 28: Teams & Memberships — core (researcher teams + team reports)
-- MasrBounty Teams & Memberships System
--
-- Design notes:
--  * Company teams keep living in company_profiles/company_members (existing,
--    prod-tested). This migration adds RESEARCHER teams only.
--  * Every sensitive mutation happens inside SECURITY DEFINER functions so
--    anti-escalation rules hold even against raw supabase-js calls, not just
--    hidden UI buttons.
--  * Invitation raw tokens are NEVER stored — only sha256(token_hash).
--  * Legacy report rows stay untouched: team_id NULL = personal report.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enum extensions (values must NOT be used inside this same transaction)
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE team_member_role AS ENUM ('owner','lead','member'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE invitation_status AS ENUM ('pending','accepted','rejected','revoked','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'member') THEN
    ALTER TYPE user_role ADD VALUE 'member';
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'team') THEN
    ALTER TYPE notification_type ADD VALUE 'team';
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  description TEXT CHECK (description IS NULL OR char_length(btrim(description)) <= 1000),
  logo_url TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  allow_join_requests BOOLEAN NOT NULL DEFAULT false,
  max_members INT NOT NULL DEFAULT 15 CHECK (max_members BETWEEN 1 AND 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams(owner_id);

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role team_member_role NOT NULL DEFAULT 'member',
  permissions JSONB NOT NULL DEFAULT '{"grant":[],"revoke":[]}'::jsonb,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id),
  CONSTRAINT team_permissions_shape CHECK (
    jsonb_typeof(permissions) = 'object'
    AND COALESCE(jsonb_typeof(permissions->'grant'), 'array') = 'array'
    AND COALESCE(jsonb_typeof(permissions->'revoke'), 'array') = 'array'
  )
);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  invited_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role team_member_role NOT NULL DEFAULT 'member' CHECK (role <> 'owner'),
  permissions JSONB NOT NULL DEFAULT '{"grant":[],"revoke":[]}'::jsonb,
  status invitation_status NOT NULL DEFAULT 'pending',
  token_hash TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT CHECK (message IS NULL OR char_length(message) <= 300),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_inv_pending ON public.team_invitations(team_id, lower(email)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_inv_email_status ON public.team_invitations(lower(email), status);
CREATE INDEX IF NOT EXISTS idx_team_inv_team_status ON public.team_invitations(team_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_inv_token_hash ON public.team_invitations(token_hash);

CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT CHECK (message IS NULL OR char_length(message) <= 300),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_join_pending ON public.team_join_requests(team_id, user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_join_user ON public.team_join_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_team_join_team ON public.team_join_requests(team_id, status);

CREATE TABLE IF NOT EXISTS public.team_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 3 AND 60),
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_activity_team ON public.team_activity_logs(team_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Reports: team ownership (additive only — legacy rows stay NULL=personal)
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS submission_scope TEXT CHECK (submission_scope IS NULL OR submission_scope IN ('personal','team'));
CREATE INDEX IF NOT EXISTS idx_reports_team ON public.reports(team_id);

-- ---------------------------------------------------------------------------
-- 4. Helper functions (mirror of lib/teams/permissions.ts defaults)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_is_team_member(p_team uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = p_team AND tm.user_id = p_user);
$$;

CREATE OR REPLACE FUNCTION public.fn_team_role(p_team uuid, p_user uuid DEFAULT auth.uid())
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tm.role::text FROM public.team_members tm WHERE tm.team_id = p_team AND tm.user_id = p_user;
$$;

CREATE OR REPLACE FUNCTION public.fn_team_permission(p_team uuid, p_perm text, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r text;
  overrides jsonb;
  defaults text[];
BEGIN
  IF p_user IS NULL OR p_perm IS NULL THEN RETURN false; END IF;
  SELECT tm.role::text, tm.permissions INTO r, overrides
  FROM public.team_members tm
  WHERE tm.team_id = p_team AND tm.user_id = p_user;
  IF r IS NULL THEN RETURN false; END IF;
  IF r = 'owner' THEN RETURN true; END IF;
  -- non-catalog permissions can never be granted via overrides (mirror of isKnownPermission)
  IF p_perm NOT IN ('team.view','team.manage_members','team.invite_members','team.manage_settings','researcher.view_team_reports','researcher.submit_reports','researcher.manage_team_work') THEN RETURN false; END IF;
  defaults := CASE r
    WHEN 'lead' THEN ARRAY['team.view','team.invite_members','researcher.view_team_reports','researcher.submit_reports','researcher.manage_team_work']
    ELSE ARRAY['team.view','researcher.view_team_reports','researcher.submit_reports']
  END;
  IF COALESCE(overrides->'revoke','[]'::jsonb) ? p_perm THEN RETURN false; END IF;
  IF COALESCE(overrides->'grant','[]'::jsonb) ? p_perm THEN RETURN true; END IF;
  RETURN p_perm = ANY(defaults);
END;
$$;

-- Activity logger: caller must be a team member (or platform admin).
CREATE OR REPLACE FUNCTION public.fn_log_team_event(p_team uuid, p_action text, p_target uuid DEFAULT NULL, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_is_team_member(p_team, auth.uid())
     AND NOT COALESCE(public.has_role('admin'), false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, target_user_id, metadata)
  VALUES (p_team, auth.uid(), left(btrim(p_action), 60), p_target, p_meta);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Team bootstrap: every created team gets its owner membership + log entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_team_bootstrap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.team_members(team_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner');
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, metadata)
  VALUES (NEW.id, NEW.owner_id, 'team.created', jsonb_build_object('name', NEW.name));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_team_bootstrap ON public.teams;
CREATE TRIGGER trg_team_bootstrap AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.fn_team_bootstrap();

-- Membership guard: owner rows immutable except through the transfer RPC;
-- identity columns frozen; non-owners cannot modify their own membership.
CREATE OR REPLACE FUNCTION public.fn_team_member_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_is_owner boolean;
BEGIN
  IF COALESCE(current_setting('app.bypass_team_guard', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' THEN RAISE EXCEPTION 'owner membership is immutable (transfer ownership instead)'; END IF;
    RETURN OLD;
  END IF;
  caller_is_owner := EXISTS (SELECT 1 FROM public.teams t WHERE t.id = NEW.team_id AND t.owner_id = auth.uid());
  IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    RAISE EXCEPTION 'owner membership is immutable (transfer ownership instead)';
  END IF;
  IF NEW.role = 'owner' AND OLD.role <> 'owner' THEN
    RAISE EXCEPTION 'use fn_transfer_team_ownership';
  END IF;
  IF NEW.team_id <> OLD.team_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'membership identity is immutable';
  END IF;
  IF NOT caller_is_owner AND NEW.user_id = auth.uid()
     AND (NEW.role <> OLD.role OR NEW.permissions IS DISTINCT FROM OLD.permissions) THEN
    RAISE EXCEPTION 'self-escalation is forbidden';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_team_member_guard ON public.team_members;
CREATE TRIGGER trg_team_member_guard BEFORE UPDATE OR DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.fn_team_member_guard();

-- ---------------------------------------------------------------------------
-- 6. Mutations as SECURITY DEFINER functions (anti-escalation in SQL itself)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_team_invitation(p_team uuid, p_email text, p_role text, p_permissions jsonb DEFAULT '{"grant":[],"revoke":[]}'::jsonb, p_message text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  raw_token text;
  capacity int;
BEGIN
  IF NOT public.fn_team_permission(p_team, 'team.invite_members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  p_email := lower(btrim(p_email));
  IF p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid email'; END IF;
  IF p_role NOT IN ('lead','member') THEN RAISE EXCEPTION 'invalid role'; END IF;
  IF NOT caller = ANY (ARRAY(SELECT tm.user_id FROM public.team_members tm WHERE tm.team_id = p_team)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT count(*) INTO capacity FROM public.team_members WHERE team_id = p_team;
  IF capacity >= (SELECT max_members FROM public.teams WHERE id = p_team) THEN RAISE EXCEPTION 'team is full'; END IF;
  IF EXISTS (SELECT 1 FROM public.team_invitations ti WHERE ti.team_id = p_team AND lower(ti.email) = p_email AND ti.status = 'pending') THEN
    RAISE EXCEPTION 'pending invitation already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = p_team AND tm.user_id = (SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE lower(u.email) = p_email LIMIT 1)) THEN
    RAISE EXCEPTION 'user is already a member';
  END IF;
  raw_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.team_invitations(team_id, email, invited_user_id, role, permissions, token_hash, invited_by, message)
  VALUES (
    p_team, p_email,
    (SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE lower(u.email) = p_email LIMIT 1),
    p_role::team_member_role, p_permissions,
    encode(sha256(convert_to(raw_token, 'UTF8')), 'hex'), caller, nullif(btrim(coalesce(p_message,'')), '')
  );
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, metadata)
  VALUES (p_team, caller, 'member.invited', jsonb_build_object('email', p_email, 'role', p_role));
  RETURN raw_token;
END;
$$;

-- Accept by raw token (email link) or by invitation id (دعواتي page).
CREATE OR REPLACE FUNCTION public.fn_accept_team_invitation(p_token text DEFAULT NULL, p_invitation_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  caller_email text := lower(coalesce(auth.email(), ''));
  inv record;
  capacity int;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_token IS NOT NULL THEN
    SELECT * INTO inv FROM public.team_invitations WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') FOR UPDATE;
  ELSIF p_invitation_id IS NOT NULL THEN
    SELECT * INTO inv FROM public.team_invitations WHERE id = p_invitation_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'token or invitation id required';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation is %', inv.status; END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.team_invitations SET status = 'expired' WHERE id = inv.id;
    RAISE EXCEPTION 'invitation expired';
  END IF;
  IF caller_email <> lower(inv.email) AND coalesce(inv.invited_user_id::text, '') <> caller::text THEN
    RAISE EXCEPTION 'invitation is addressed to a different email';
  END IF;
  SELECT count(*) INTO capacity FROM public.team_members WHERE team_id = inv.team_id;
  IF capacity >= (SELECT max_members FROM public.teams WHERE id = inv.team_id) THEN RAISE EXCEPTION 'team is full'; END IF;
  UPDATE public.team_invitations SET status = 'accepted', responded_at = now(), invited_user_id = coalesce(invited_user_id, caller) WHERE id = inv.id;
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, target_user_id, metadata)
  VALUES (inv.team_id, caller, 'member.joined', caller, jsonb_build_object('role', inv.role::text));
  IF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = inv.team_id AND user_id = caller) THEN
    RETURN inv.team_id;
  END IF;
  INSERT INTO public.team_members(team_id, user_id, role, permissions, invited_by)
  VALUES (inv.team_id, caller, inv.role, inv.permissions, inv.invited_by);
  RETURN inv.team_id;
END;
$$;

-- Invitee rejects (or withdraws) — only the invited person may do this.
CREATE OR REPLACE FUNCTION public.fn_reject_team_invitation(p_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  inv record;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO inv FROM public.team_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF lower(coalesce(auth.email(),'')) <> lower(inv.email) AND coalesce(inv.invited_user_id::text,'') <> caller::text THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation is %', inv.status; END IF;
  UPDATE public.team_invitations SET status = 'rejected', responded_at = now() WHERE id = inv.id;
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, metadata)
  VALUES (inv.team_id, caller, 'invitation.rejected', jsonb_build_object('email', inv.email));
END;
$$;

-- Manager revokes a pending invitation.
CREATE OR REPLACE FUNCTION public.fn_revoke_team_invitation(p_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); inv record;
BEGIN
  SELECT * INTO inv FROM public.team_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF NOT public.fn_team_permission(inv.team_id, 'team.manage_members')
     AND NOT public.fn_team_permission(inv.team_id, 'team.invite_members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation is %', inv.status; END IF;
  UPDATE public.team_invitations SET status = 'revoked', responded_at = now() WHERE id = inv.id;
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, metadata)
  VALUES (inv.team_id, caller, 'invitation.revoked', jsonb_build_object('email', inv.email));
END;
$$;

-- Manager resends: fresh token + extended expiry, still one pending per email.
CREATE OR REPLACE FUNCTION public.fn_resend_team_invitation(p_invitation_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); inv record; raw_token text;
BEGIN
  SELECT * INTO inv FROM public.team_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF NOT public.fn_team_permission(inv.team_id, 'team.manage_members')
     AND NOT public.fn_team_permission(inv.team_id, 'team.invite_members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF inv.status NOT IN ('pending','expired') THEN RAISE EXCEPTION 'invitation is %', inv.status; END IF;
  IF EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = inv.team_id
             AND tm.user_id = (SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE lower(u.email) = lower(inv.email) LIMIT 1)) THEN
    RAISE EXCEPTION 'user is already a member';
  END IF;
  raw_token := encode(gen_random_bytes(32), 'hex');
  UPDATE public.team_invitations
  SET status = 'pending', token_hash = encode(sha256(convert_to(raw_token, 'UTF8')), 'hex'),
      expires_at = now() + interval '7 days', created_at = now(), responded_at = NULL
  WHERE id = inv.id;
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, metadata)
  VALUES (inv.team_id, caller, 'invitation.resent', jsonb_build_object('email', inv.email));
  RETURN raw_token;
END;
$$;

-- Member management (remove / change role+permissions) with anti-escalation.
CREATE OR REPLACE FUNCTION public.fn_change_team_member(p_member_id uuid, p_role text, p_grant jsonb DEFAULT '[]'::jsonb, p_revoke jsonb DEFAULT '[]'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  is_owner boolean;
  target record;
  perm text;
BEGIN
  SELECT * INTO target FROM public.team_members WHERE id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'member not found'; END IF;
  is_owner := EXISTS (SELECT 1 FROM public.teams t WHERE t.id = target.team_id AND t.owner_id = caller);
  IF NOT is_owner AND NOT public.fn_team_permission(target.team_id, 'team.manage_members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF target.role = 'owner' THEN RAISE EXCEPTION 'owner membership is immutable'; END IF;
  IF target.user_id = caller AND NOT is_owner THEN RAISE EXCEPTION 'self-escalation is forbidden'; END IF;
  IF p_role NOT IN ('lead','member') THEN RAISE EXCEPTION 'invalid role'; END IF;
  IF jsonb_typeof(p_grant) <> 'array' OR jsonb_typeof(p_revoke) <> 'array' THEN RAISE EXCEPTION 'invalid grant/revoke lists'; END IF;
  -- overrides may only reference the known team permission catalog
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_grant) g WHERE g NOT IN ('team.view','team.manage_members','team.invite_members','team.manage_settings','researcher.view_team_reports','researcher.submit_reports','researcher.manage_team_work'))
     OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_revoke) r2 WHERE r2 NOT IN ('team.view','team.manage_members','team.invite_members','team.manage_settings','researcher.view_team_reports','researcher.submit_reports','researcher.manage_team_work')) THEN
    RAISE EXCEPTION 'unknown permission in grant/revoke lists';
  END IF;
  IF NOT is_owner THEN
    -- a manager can only grant permissions they themselves hold
    FOR perm IN SELECT jsonb_array_elements_text(p_grant) LOOP
      IF NOT public.fn_team_permission(target.team_id, perm, caller) THEN RAISE EXCEPTION 'cannot grant a permission you do not hold: %', perm; END IF;
    END LOOP;
    IF p_role = 'lead' AND public.fn_team_role(target.team_id, caller) <> 'owner' THEN
      RAISE EXCEPTION 'only the team owner can promote to lead';
    END IF;
  END IF;
  UPDATE public.team_members
  SET role = p_role::team_member_role,
      permissions = jsonb_build_object('grant', p_grant, 'revoke', p_revoke)
  WHERE id = p_member_id;
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, target_user_id, metadata)
  VALUES (target.team_id, caller, 'member.updated', target.user_id, jsonb_build_object('role', p_role, 'grant', p_grant, 'revoke', p_revoke));
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_remove_team_member(p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); target record;
BEGIN
  SELECT * INTO target FROM public.team_members WHERE id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'member not found'; END IF;
  IF NOT public.fn_team_permission(target.team_id, 'team.manage_members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF target.role = 'owner' THEN RAISE EXCEPTION 'owner membership is immutable'; END IF;
  DELETE FROM public.team_members WHERE id = p_member_id;
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, target_user_id, metadata)
  VALUES (target.team_id, caller, 'member.removed', target.user_id, '{}');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_leave_team(p_team uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); target record;
BEGIN
  SELECT * INTO target FROM public.team_members WHERE team_id = p_team AND user_id = caller;
  IF NOT FOUND THEN RAISE EXCEPTION 'not a member'; END IF;
  IF target.role = 'owner' THEN RAISE EXCEPTION 'owner cannot leave — transfer ownership first'; END IF;
  DELETE FROM public.team_members WHERE id = target.id;
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, target_user_id, metadata)
  VALUES (p_team, caller, 'member.left', caller, '{}');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_transfer_team_ownership(p_team uuid, p_new_owner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team AND owner_id = caller) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = p_team AND user_id = p_new_owner) THEN
    RAISE EXCEPTION 'new owner must be an active member';
  END IF;
  PERFORM set_config('app.bypass_team_guard', 'on', true);
  UPDATE public.teams SET owner_id = p_new_owner, updated_at = now() WHERE id = p_team;
  UPDATE public.team_members SET role = 'member', permissions = '{"grant":[],"revoke":[]}'::jsonb WHERE team_id = p_team AND user_id = caller;
  UPDATE public.team_members SET role = 'owner', permissions = '{"grant":[],"revoke":[]}'::jsonb WHERE team_id = p_team AND user_id = p_new_owner;
  INSERT INTO public.team_activity_logs(team_id, actor_id, action, target_user_id, metadata)
  VALUES (p_team, caller, 'team.owner_transferred', p_new_owner, '{}');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_request_team_join(p_team uuid, p_message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); capacity int;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team AND allow_join_requests) THEN RAISE EXCEPTION 'join requests are disabled for this team'; END IF;
  IF public.fn_is_team_member(p_team, caller) THEN RAISE EXCEPTION 'already a member'; END IF;
  IF EXISTS (SELECT 1 FROM public.team_join_requests WHERE team_id = p_team AND user_id = caller AND status = 'pending') THEN
    RAISE EXCEPTION 'request already pending';
  END IF;
  SELECT count(*) INTO capacity FROM public.team_members WHERE team_id = p_team;
  IF capacity >= (SELECT max_members FROM public.teams WHERE id = p_team) THEN RAISE EXCEPTION 'team is full'; END IF;
  RETURN (INSERT INTO public.team_join_requests(team_id, user_id, message) VALUES (p_team, caller, nullif(btrim(coalesce(p_message,'')),'')) RETURNING id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_decide_team_join(p_request uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); req record; capacity int;
BEGIN
  SELECT * INTO req FROM public.team_join_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF NOT public.fn_team_permission(req.team_id, 'team.manage_members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'request is %', req.status; END IF;
  IF p_approve THEN
    SELECT count(*) INTO capacity FROM public.team_members WHERE team_id = req.team_id;
    IF capacity >= (SELECT max_members FROM public.teams WHERE id = req.team_id) THEN RAISE EXCEPTION 'team is full'; END IF;
    UPDATE public.team_join_requests SET status = 'approved', decided_at = now(), decided_by = caller WHERE id = req.id;
    IF NOT public.fn_is_team_member(req.team_id, req.user_id) THEN
      INSERT INTO public.team_members(team_id, user_id, role, invited_by) VALUES (req.team_id, req.user_id, 'member', caller);
    END IF;
    INSERT INTO public.team_activity_logs(team_id, actor_id, action, target_user_id, metadata)
    VALUES (req.team_id, caller, 'member.joined', req.user_id, jsonb_build_object('via', 'join_request'));
  ELSE
    UPDATE public.team_join_requests SET status = 'rejected', decided_at = now(), decided_by = caller WHERE id = req.id;
    INSERT INTO public.team_activity_logs(team_id, actor_id, action, target_user_id, metadata)
    VALUES (req.team_id, caller, 'join_request.rejected', req.user_id, '{}');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Reports RLS: extend insert policy (team scope must be legitimate) + team read
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "rep_insert" ON public.reports;
CREATE POLICY "rep_insert" ON public.reports FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id = researcher_id AND rp.user_id = auth.uid())
  AND EXISTS(
    SELECT 1 FROM public.programs p
    WHERE p.id = program_id
      AND p.status = 'active'
      AND (
        p.visibility = 'public'
        OR EXISTS(SELECT 1 FROM public.program_researchers pr WHERE pr.program_id = p.id AND pr.researcher_id = rp.id AND pr.status = 'accepted')
      )
  )
  AND (team_id IS NULL OR public.fn_team_permission(team_id, 'researcher.submit_reports'))
);

DROP POLICY IF EXISTS "team_reports_read" ON public.reports;
CREATE POLICY "team_reports_read" ON public.reports FOR SELECT TO authenticated USING (
  team_id IS NOT NULL AND public.fn_team_permission(team_id, 'researcher.view_team_reports')
);

-- ---------------------------------------------------------------------------
-- 8. RLS for the new tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_select" ON public.teams;
CREATE POLICY "teams_select" ON public.teams FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "teams_insert" ON public.teams;
CREATE POLICY "teams_insert" ON public.teams FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "teams_update" ON public.teams;
CREATE POLICY "teams_update" ON public.teams FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.fn_team_permission(id, 'team.manage_settings'))
  WITH CHECK (owner_id = auth.uid() OR public.fn_team_permission(id, 'team.manage_settings'));
DROP POLICY IF EXISTS "teams_delete" ON public.teams;
CREATE POLICY "teams_delete" ON public.teams FOR DELETE TO authenticated USING (owner_id = auth.uid());

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tm_select" ON public.team_members;
CREATE POLICY "tm_select" ON public.team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.fn_is_team_member(team_id));
-- all writes happen through the SECURITY DEFINER functions above
REVOKE INSERT, UPDATE, DELETE ON public.team_members FROM authenticated, anon;

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ti_select" ON public.team_invitations;
CREATE POLICY "ti_select" ON public.team_invitations FOR SELECT TO authenticated USING (
  public.fn_team_permission(team_id, 'team.view')
  OR lower(email) = lower(coalesce(auth.email(), ''))
  OR invited_user_id = auth.uid()
);
REVOKE INSERT, UPDATE, DELETE ON public.team_invitations FROM authenticated, anon;

ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tjr_select" ON public.team_join_requests;
CREATE POLICY "tjr_select" ON public.team_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.fn_is_team_member(team_id));
REVOKE INSERT, UPDATE, DELETE ON public.team_join_requests FROM authenticated, anon;

ALTER TABLE public.team_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tal_select" ON public.team_activity_logs;
CREATE POLICY "tal_select" ON public.team_activity_logs FOR SELECT TO authenticated
  USING (public.fn_is_team_member(team_id) OR public.has_role('admin'));
REVOKE INSERT, UPDATE, DELETE ON public.team_activity_logs FROM authenticated, anon;

-- ---------------------------------------------------------------------------
-- 9. Grants (service_role keeps full access; admins read activity logs)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT ON public.team_members TO authenticated;
GRANT SELECT ON public.team_invitations TO authenticated;
GRANT SELECT ON public.team_join_requests TO authenticated;
GRANT SELECT ON public.team_activity_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_team_invitation(uuid, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_accept_team_invitation(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reject_team_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_revoke_team_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resend_team_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_change_team_member(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_remove_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_leave_team(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_transfer_team_ownership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_request_team_join(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_decide_team_join(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_log_team_event(uuid, text, uuid, jsonb) TO authenticated;

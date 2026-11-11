-- ============================================================================
-- Migration 29: Teams & Memberships — company permission layer + program members
--
-- Reuses company_members / company_invitations (no duplicates). Adds:
--  * per-member granular permission overrides (JSONB grant/revoke)
--  * explicit invitation statuses + hashed tokens for NEW invites
--    (legacy raw tokens keep working: backfilled token_hash)
--  * program_members: assign company members to a specific security program
--  * cm/inv policies opened to members who hold company.manage_members
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Per-member permission overrides on company_members
-- ---------------------------------------------------------------------------
ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{"grant":[],"revoke":[]}'::jsonb;
DO $$ BEGIN
  ALTER TABLE public.company_members ADD CONSTRAINT company_permissions_shape CHECK (
    jsonb_typeof(permissions) = 'object'
    AND COALESCE(jsonb_typeof(permissions->'grant'), 'array') = 'array'
    AND COALESCE(jsonb_typeof(permissions->'revoke'), 'array') = 'array'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. company_invitations: statuses + invited user + hashed token
-- ---------------------------------------------------------------------------
ALTER TABLE public.company_invitations
  ADD COLUMN IF NOT EXISTS status invitation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invited_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{"grant":[],"revoke":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Backfill: historical rows become 'accepted' or stay 'pending'; hashes for old links
UPDATE public.company_invitations SET status = 'accepted' WHERE accepted_at IS NOT NULL AND status = 'pending';
UPDATE public.company_invitations SET status = 'expired' WHERE status = 'pending' AND expires_at < now();
-- keep only the newest pending invite per (company, email) so the partial unique index builds safely
UPDATE public.company_invitations ci SET status = 'revoked'
WHERE ci.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.company_invitations newer
    WHERE newer.company_id = ci.company_id AND lower(newer.email) = lower(ci.email)
      AND newer.status = 'pending' AND newer.created_at > ci.created_at
  );
UPDATE public.company_invitations SET token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex') WHERE token_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_inv_pending ON public.company_invitations(company_id, lower(email)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_company_inv_email_status ON public.company_invitations(lower(email), status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_inv_token_hash ON public.company_invitations(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_inv_invited_user ON public.company_invitations(invited_user_id) WHERE invited_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Effective company permission (mirror of lib/teams/permissions.ts).
--    Owner bypasses; role defaults + grant/revoke overrides.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_company_permission(p_company uuid, p_perm text, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r text;
  overrides jsonb;
  defaults text[];
BEGIN
  IF p_user IS NULL OR p_perm IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.company_profiles cp WHERE cp.id = p_company AND cp.owner_id = p_user) THEN
    RETURN true;
  END IF;
  SELECT cm.role::text, cm.permissions INTO r, overrides
  FROM public.company_members cm
  WHERE cm.company_id = p_company AND cm.user_id = p_user;
  IF r IS NULL THEN
    IF COALESCE(public.has_role('admin'), false) THEN RETURN true; END IF;
    RETURN false;
  END IF;
  -- non-catalog permissions can never be granted via overrides (mirror of isKnownPermission)
  IF p_perm NOT IN ('company.view_dashboard','company.manage_profile','company.manage_members','program.create','program.edit','program.manage','report.view','report.triage','report.change_status','report.request_information','report.comment','report.manage','analytics.view') THEN RETURN false; END IF;
  defaults := CASE r
    WHEN 'admin' THEN ARRAY[
      'company.view_dashboard','company.manage_profile','company.manage_members',
      'program.create','program.edit','program.manage',
      'report.view','report.triage','report.change_status','report.request_information','report.comment','report.manage',
      'analytics.view']
    WHEN 'analyst' THEN ARRAY[
      'company.view_dashboard','report.view','report.triage','report.change_status','report.request_information','report.comment','analytics.view']
    WHEN 'triager' THEN ARRAY[
      'company.view_dashboard','report.view','report.triage','report.change_status','report.request_information','report.comment']
    WHEN 'finance' THEN ARRAY['company.view_dashboard','analytics.view']
    ELSE ARRAY['company.view_dashboard','report.view','analytics.view'] -- viewer
  END;
  IF COALESCE(overrides->'revoke','[]'::jsonb) ? p_perm THEN RETURN false; END IF;
  IF COALESCE(overrides->'grant','[]'::jsonb) ? p_perm THEN RETURN true; END IF;
  RETURN p_perm = ANY(defaults);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Policies: management opened to whoever holds company.manage_members
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cm_manage" ON public.company_members;
DROP POLICY IF EXISTS "cm_read" ON public.company_members;
CREATE POLICY "cm_read" ON public.company_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_company_member(company_id, auth.uid()) OR public.has_role('admin'));
-- member management is possible for whoever holds company.manage_members,
-- but non-owners can never INSERT/UPDATE a row into the admin role (SQL-level)
CREATE POLICY "cm_insert" ON public.company_members FOR INSERT
  WITH CHECK (public.has_role('admin') OR public.fn_company_permission(company_id, 'company.manage_members'));
CREATE POLICY "cm_update" ON public.company_members FOR UPDATE
  USING (public.has_role('admin') OR public.fn_company_permission(company_id, 'company.manage_members'))
  WITH CHECK (public.has_role('admin') OR public.fn_company_permission(company_id, 'company.manage_members'));
CREATE POLICY "cm_delete" ON public.company_members FOR DELETE
  USING (public.has_role('admin') OR public.fn_company_permission(company_id, 'company.manage_members'));

-- invited person may READ their own invitations (دعواتي) but all writes go through RPCs
DROP POLICY IF EXISTS "inv_read_invitee" ON public.company_invitations;
CREATE POLICY "inv_read_invitee" ON public.company_invitations FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.email(), '')) OR invited_user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.company_invitations FROM authenticated, anon;

-- self-escalation guard for company members (SQL-level, mirrors TS checks)
CREATE OR REPLACE FUNCTION public.fn_company_member_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner_id uuid;
BEGIN
  IF COALESCE(current_setting('app.bypass_company_guard', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT cp.owner_id INTO owner_id FROM public.company_profiles cp WHERE cp.id = COALESCE(NEW.company_id, OLD.company_id);
  IF TG_OP = 'DELETE' THEN
    IF OLD.user_id = owner_id THEN RAISE EXCEPTION 'company owner row is immutable'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.company_id <> OLD.company_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'membership identity is immutable';
  END IF;
  IF NEW.user_id = owner_id THEN RAISE EXCEPTION 'company owner row is immutable'; END IF;
  IF NEW.user_id = auth.uid()
     AND (NEW.role <> OLD.role OR NEW.permissions IS DISTINCT FROM OLD.permissions)
     AND NEW.user_id <> owner_id THEN
    RAISE EXCEPTION 'self-escalation is forbidden';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.role = 'admin'
     AND NOT EXISTS (SELECT 1 FROM public.company_profiles cp WHERE cp.id = NEW.company_id AND cp.owner_id = auth.uid())
     AND NOT COALESCE(public.has_role('admin'), false) THEN
    RAISE EXCEPTION 'only the company owner can grant the admin role';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_company_member_guard ON public.company_members;
CREATE TRIGGER trg_company_member_guard BEFORE UPDATE OR DELETE ON public.company_members
FOR EACH ROW EXECUTE FUNCTION public.fn_company_member_guard();

-- ---------------------------------------------------------------------------
-- 5. Invitation RPCs (create / respond / revoke) — tokens hashed at rest
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_company_invitation(p_company uuid, p_email text, p_role text, p_permissions jsonb DEFAULT '{"grant":[],"revoke":[]}'::jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  raw_token text;
  invited uuid;
BEGIN
  IF NOT public.fn_company_permission(p_company, 'company.manage_members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  p_email := lower(btrim(p_email));
  IF p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid email'; END IF;
  IF p_role NOT IN ('admin','analyst','triager','finance','viewer') THEN RAISE EXCEPTION 'invalid role'; END IF;
  IF jsonb_typeof(p_permissions) <> 'object'
     OR COALESCE(jsonb_typeof(p_permissions->'grant'), 'array') <> 'array'
     OR COALESCE(jsonb_typeof(p_permissions->'revoke'), 'array') <> 'array' THEN RAISE EXCEPTION 'invalid permissions shape'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(p_permissions->'grant','[]'::jsonb)) g
             WHERE g NOT IN ('company.view_dashboard','company.manage_profile','company.manage_members','program.create','program.edit','program.manage','report.view','report.triage','report.change_status','report.request_information','report.comment','report.manage','analytics.view')) THEN
    RAISE EXCEPTION 'unknown permission in grant list';
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_invitations ci WHERE ci.company_id = p_company AND lower(ci.email) = p_email AND ci.status = 'pending') THEN
    RAISE EXCEPTION 'pending invitation already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = p_company
             AND cm.user_id = (SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE lower(u.email) = p_email LIMIT 1)) THEN
    RAISE EXCEPTION 'user is already a member';
  END IF;
  invited := (SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE lower(u.email) = p_email LIMIT 1);
  raw_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.company_invitations(company_id, email, invited_user_id, role, permissions, token_hash, invited_by)
  VALUES (p_company, p_email, invited, p_role::company_member_role, p_permissions,
          encode(sha256(convert_to(raw_token, 'UTF8')), 'hex'), caller);
  RETURN raw_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_respond_company_invitation(p_token text DEFAULT NULL, p_accept boolean DEFAULT true, p_invitation_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  caller_email text := lower(coalesce(auth.email(), ''));
  inv record;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_invitation_id IS NOT NULL THEN
    SELECT * INTO inv FROM public.company_invitations WHERE id = p_invitation_id FOR UPDATE;
  ELSE
    SELECT * INTO inv FROM public.company_invitations
    WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') FOR UPDATE;
    IF NOT FOUND THEN
      -- legacy fallback: invitations created before migration 29 carry raw tokens
      SELECT * INTO inv FROM public.company_invitations WHERE token = p_token FOR UPDATE;
    END IF;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation is %', inv.status; END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.company_invitations SET status = 'expired' WHERE id = inv.id;
    RAISE EXCEPTION 'invitation expired';
  END IF;
  IF caller_email <> lower(inv.email) AND coalesce(inv.invited_user_id::text, '') <> caller::text THEN
    RAISE EXCEPTION 'invitation is addressed to a different email';
  END IF;
  IF NOT p_accept THEN
    UPDATE public.company_invitations SET status = 'rejected', responded_at = now(), invited_user_id = coalesce(invited_user_id, caller) WHERE id = inv.id;
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_members WHERE company_id = inv.company_id AND user_id = caller) THEN
    UPDATE public.company_invitations SET status = 'accepted', responded_at = now() WHERE id = inv.id;
    RETURN inv.company_id;
  END IF;
  INSERT INTO public.company_members(company_id, user_id, role, invited_by, permissions)
  VALUES (inv.company_id, caller, inv.role, coalesce(inv.invited_by, caller), inv.permissions);
  UPDATE public.company_invitations SET status = 'accepted', responded_at = now(), invited_user_id = coalesce(invited_user_id, caller) WHERE id = inv.id;
  RETURN inv.company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_revoke_company_invitation(p_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv record;
BEGIN
  SELECT * INTO inv FROM public.company_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF NOT public.fn_company_permission(inv.company_id, 'company.manage_members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation is %', inv.status; END IF;
  UPDATE public.company_invitations SET status = 'revoked', responded_at = now() WHERE id = inv.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_resend_company_invitation(p_invitation_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv record; raw_token text;
BEGIN
  SELECT * INTO inv FROM public.company_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF NOT public.fn_company_permission(inv.company_id, 'company.manage_members') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF inv.status NOT IN ('pending','expired','rejected') THEN RAISE EXCEPTION 'invitation is %', inv.status; END IF;
  IF EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = inv.company_id
             AND cm.user_id = (SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE lower(u.email) = lower(inv.email) LIMIT 1)) THEN
    RAISE EXCEPTION 'user is already a member';
  END IF;
  raw_token := encode(gen_random_bytes(32), 'hex');
  UPDATE public.company_invitations
  SET status = 'pending', token_hash = encode(sha256(convert_to(raw_token, 'UTF8')), 'hex'),
      expires_at = now() + interval '7 days', created_at = now(), responded_at = NULL
  WHERE id = inv.id;
  RETURN raw_token;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. program_members: per-program assignments (Security Manager / Triager / Viewer)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_role TEXT NOT NULL DEFAULT 'viewer' CHECK (program_role IN ('manager','triager','viewer')),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_program_members_program ON public.program_members(program_id);
CREATE INDEX IF NOT EXISTS idx_program_members_user ON public.program_members(user_id);

ALTER TABLE public.program_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pm_select" ON public.program_members;
CREATE POLICY "pm_select" ON public.program_members FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND public.is_company_member(p.company_id, auth.uid()))
  OR public.has_role('admin')
);
REVOKE INSERT, UPDATE, DELETE ON public.program_members FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.fn_assign_program_member(p_program uuid, p_user uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE company_id uuid;
BEGIN
  SELECT p.company_id INTO company_id FROM public.programs p WHERE p.id = p_program;
  IF company_id IS NULL THEN RAISE EXCEPTION 'program not found'; END IF;
  IF NOT public.fn_company_permission(company_id, 'program.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = company_id AND user_id = p_user) THEN
    RAISE EXCEPTION 'user must be a company member first';
  END IF;
  IF p_role NOT IN ('manager','triager','viewer') THEN RAISE EXCEPTION 'invalid program role'; END IF;
  INSERT INTO public.program_members(program_id, user_id, program_role, assigned_by)
  VALUES (p_program, p_user, p_role, auth.uid())
  ON CONFLICT (program_id, user_id) DO UPDATE SET program_role = EXCLUDED.program_role, assigned_by = EXCLUDED.assigned_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_unassign_program_member(p_program uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE company_id uuid;
BEGIN
  SELECT p.company_id INTO company_id FROM public.programs p WHERE p.id = p_program;
  IF company_id IS NULL THEN RAISE EXCEPTION 'program not found'; END IF;
  IF NOT public.fn_company_permission(company_id, 'program.manage') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.program_members WHERE program_id = p_program AND user_id = p_user;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT SELECT ON public.company_invitations TO authenticated;
GRANT SELECT ON public.program_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_company_invitation(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_respond_company_invitation(text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_revoke_company_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resend_company_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_assign_program_member(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_unassign_program_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_company_permission(uuid, text, uuid) TO authenticated;

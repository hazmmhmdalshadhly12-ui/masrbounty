-- ============================================================
-- 18. SECURITY HARDENING V2 (idempotent, re-runnable)
-- Date: 2026-11  — MasrBounty security audit remediation.
-- Run order: after masrbounty.sql (or directly on an existing
-- production database — every statement is idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 18.1 identity-documents bucket (P0)
-- BEFORE: every authenticated user could READ/UPLOAD every KYC
-- identity document. NOW: owner-scoped via researcher_profiles
-- (upload paths are "<researcher_profiles.id>/<ts>-<file>")
-- plus admin/moderator staff access.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "iddoc_select" ON storage.objects;
CREATE POLICY "iddoc_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'identity-documents'
  AND auth.role() = 'authenticated'
  AND (
    public.has_role('admin') OR public.has_role('moderator')
    OR (storage.foldername(name))[1] IN (
      SELECT rp.id::text FROM public.researcher_profiles rp WHERE rp.user_id = auth.uid()
    )
  )
);
DROP POLICY IF EXISTS "iddoc_upload" ON storage.objects;
CREATE POLICY "iddoc_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'identity-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT rp.id::text FROM public.researcher_profiles rp WHERE rp.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "iddoc_update" ON storage.objects;
CREATE POLICY "iddoc_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'identity-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT rp.id::text FROM public.researcher_profiles rp WHERE rp.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "iddoc_delete" ON storage.objects;
CREATE POLICY "iddoc_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'identity-documents'
  AND auth.role() = 'authenticated'
  AND (
    public.has_role('admin')
    OR (storage.foldername(name))[1] IN (
      SELECT rp.id::text FROM public.researcher_profiles rp WHERE rp.user_id = auth.uid()
    )
  )
);

-- ------------------------------------------------------------
-- 18.2 report-attachments upload ownership (P0-adjacent)
-- BEFORE: any authenticated user could upload objects into any
-- report folder. NOW: uploader must be a participant of the
-- target report (reporter / company member / admin).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "attach_upload" ON storage.objects;
CREATE POLICY "attach_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'report-attachments'
  AND auth.role() = 'authenticated'
  AND EXISTS(
    SELECT 1 FROM public.reports r
    WHERE r.id = ((storage.foldername(name))[1])::uuid
      AND (
        EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id = r.researcher_id AND rp.user_id = auth.uid())
        OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id = r.program_id AND public.is_company_member(p.company_id, auth.uid()))
        OR public.has_role('admin')
      )
  )
);

-- ------------------------------------------------------------
-- 18.3 report_comments INSERT must require report access (P0)
-- BEFORE: only author_id checked — any user could attach
-- comments (incl. internal-flagged) to any report id.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "rc_insert" ON public.report_comments;
CREATE POLICY "rc_insert" ON public.report_comments FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND (
    is_internal = false
    OR public.has_role('admin') OR public.has_role('moderator')
    OR EXISTS(
      SELECT 1 FROM public.reports r
      JOIN public.programs p ON p.id = r.program_id
      WHERE r.id = report_id AND public.is_company_member(p.company_id, auth.uid())
    )
  )
  AND EXISTS(
    SELECT 1 FROM public.reports r
    WHERE r.id = report_id
      AND (
        EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id = r.researcher_id AND rp.user_id = auth.uid())
        OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id = r.program_id AND public.is_company_member(p.company_id, auth.uid()))
        OR public.has_role('admin') OR public.has_role('moderator')
      )
  )
);

-- ------------------------------------------------------------
-- 18.4 report_attachments metadata INSERT (P0-adjacent)
-- Metadata row must reference a report the uploader can access.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "ra_insert" ON public.report_attachments;
CREATE POLICY "ra_insert" ON public.report_attachments FOR INSERT WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS(
    SELECT 1 FROM public.reports r
    WHERE r.id = report_id
      AND (
        EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id = r.researcher_id AND rp.user_id = auth.uid())
        OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id = r.program_id AND public.is_company_member(p.company_id, auth.uid()))
        OR public.has_role('admin')
      )
  )
);

-- ------------------------------------------------------------
-- 18.5 dispute_messages INSERT must require dispute access (P0)
-- BEFORE: any user could append messages to any dispute.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "dmsg_insert" ON public.dispute_messages;
CREATE POLICY "dmsg_insert" ON public.dispute_messages FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND EXISTS(
    SELECT 1 FROM public.disputes d
    JOIN public.reports r ON r.id = d.report_id
    WHERE d.id = dispute_id
      AND (
        d.opened_by = auth.uid()
        OR EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id = r.researcher_id AND rp.user_id = auth.uid())
        OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id = r.program_id AND public.is_company_member(p.company_id, auth.uid()))
        OR public.has_role('admin') OR public.has_role('moderator')
      )
  )
);

-- ------------------------------------------------------------
-- 18.6 Anon-readable join tables leak private data (P1)
-- report_label_links / report_duplicates / report_assignees:
-- restrict to report participants + staff.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "rll_read" ON public.report_label_links;
CREATE POLICY "rll_read" ON public.report_label_links FOR SELECT USING (
  public.has_role('admin') OR public.has_role('moderator')
  OR EXISTS(
    SELECT 1 FROM public.reports r
    WHERE r.id = report_id
      AND (
        EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id = r.researcher_id AND rp.user_id = auth.uid())
        OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id = r.program_id AND public.is_company_member(p.company_id, auth.uid()))
      )
  )
);
DROP POLICY IF EXISTS "rd_read" ON public.report_duplicates;
CREATE POLICY "rd_read" ON public.report_duplicates FOR SELECT USING (
  public.has_role('admin') OR public.has_role('moderator')
  OR EXISTS(
    SELECT 1 FROM public.reports r
    WHERE r.id = report_id
      AND (
        EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id = r.researcher_id AND rp.user_id = auth.uid())
        OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id = r.program_id AND public.is_company_member(p.company_id, auth.uid()))
      )
  )
);
DROP POLICY IF EXISTS "ras_read" ON public.report_assignees;
CREATE POLICY "ras_read" ON public.report_assignees FOR SELECT USING (
  public.has_role('admin') OR public.has_role('moderator')
  OR EXISTS(
    SELECT 1 FROM public.reports r
    WHERE r.id = report_id
      AND (
        EXISTS(SELECT 1 FROM public.researcher_profiles rp WHERE rp.id = r.researcher_id AND rp.user_id = auth.uid())
        OR EXISTS(SELECT 1 FROM public.programs p WHERE p.id = r.program_id AND public.is_company_member(p.company_id, auth.uid()))
      )
  )
);

-- ------------------------------------------------------------
-- 18.7 program_researchers (private invites) + activity (P1)
-- BEFORE: USING (true) leaked invite-only program membership
-- and per-researcher viewing activity to everyone.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "prg_res_read" ON public.program_researchers;
CREATE POLICY "prg_res_read" ON public.program_researchers FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    public.has_role('admin') OR public.has_role('moderator')
    OR researcher_id IN (SELECT rp.id FROM public.researcher_profiles rp WHERE rp.user_id = auth.uid())
    OR EXISTS(
      SELECT 1 FROM public.programs p
      WHERE p.id = program_id AND public.is_company_member(p.company_id, auth.uid())
    )
  )
);
DROP POLICY IF EXISTS "rpa_read" ON public.researcher_program_activity;
CREATE POLICY "rpa_read" ON public.researcher_program_activity FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    public.has_role('admin')
    OR researcher_id IN (SELECT rp.id FROM public.researcher_profiles rp WHERE rp.user_id = auth.uid())
    OR EXISTS(
      SELECT 1 FROM public.programs p
      WHERE p.id = program_id AND public.is_company_member(p.company_id, auth.uid())
    )
  )
);

-- ------------------------------------------------------------
-- 18.8 reports UPDATE: researchers must not flip triage fields
-- (P1) Trigger guard: status / severity / bounty_amount can only
-- change by the program company (triage rank+) or staff. The
-- reporter may still edit their own draft content fields.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_report_triage_fields() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.severity IS DISTINCT FROM OLD.severity
     OR NEW.bounty_amount IS DISTINCT FROM OLD.bounty_amount THEN
    IF public.has_role('admin') OR public.has_role('moderator')
       OR EXISTS(
         SELECT 1 FROM public.programs p
         WHERE p.id = NEW.program_id
           AND public.company_role(p.company_id, auth.uid()) IN ('owner','admin','triager','finance')
       ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'forbidden: triage fields are managed by the program company or staff';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_protect_report_triage ON public.reports;
CREATE TRIGGER trg_protect_report_triage BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.protect_report_triage_fields();

-- ------------------------------------------------------------
-- 18.9 Money RPCs: role-rank enforcement (P1)
-- award_bounty: company triage rank+ (owner/admin/finance/triager)
--   — viewers/analysts can no longer move money.
-- pay_award: company finance rank+ (owner/admin/finance) AND the
--   award must be in 'approved' state.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_bounty(p_report UUID, p_amount NUMERIC)
RETURNS UUID AS $$
DECLARE v_program UUID; v_company UUID; v_researcher UUID; v_uid UUID;
  v_wallet UUID; v_award UUID; v_existing TEXT;
  v_fee_pct NUMERIC; v_fee NUMERIC; v_net NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT program_id, researcher_id INTO v_program, v_researcher FROM public.reports WHERE id = p_report;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  SELECT company_id INTO v_company FROM public.programs WHERE id = v_program;
  IF NOT (
    public.has_company_permission(v_company, 'triage')
    OR public.has_role('admin')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  SELECT status INTO v_existing FROM public.bounty_awards WHERE report_id = p_report;
  IF v_existing IN ('approved','paid') THEN RAISE EXCEPTION 'already awarded'; END IF;
  SELECT COALESCE((value->>'percent')::NUMERIC, (value)::NUMERIC, 10) INTO v_fee_pct
    FROM public.platform_settings WHERE key = 'platform_fee' LIMIT 1;
  IF v_fee_pct IS NULL THEN v_fee_pct := 10; END IF;
  v_fee_pct := GREATEST(0, LEAST(50, v_fee_pct));
  v_fee := round(p_amount * v_fee_pct / 100, 2);
  v_net := p_amount - v_fee;
  INSERT INTO public.bounty_awards(report_id, amount, status, awarded_by)
  VALUES (p_report, v_net, 'approved', v_uid)
  ON CONFLICT (report_id) DO UPDATE SET amount = v_net, status = 'approved', awarded_by = v_uid
  RETURNING id INTO v_award;
  INSERT INTO public.platform_revenue(award_id, gross_amount, fee_percent, fee_amount, net_amount)
  VALUES (v_award, p_amount, v_fee_pct, v_fee, v_net)
  ON CONFLICT (award_id) DO UPDATE SET gross_amount = p_amount, fee_percent = v_fee_pct, fee_amount = v_fee, net_amount = v_net;
  SELECT id INTO v_wallet FROM public.wallets WHERE researcher_id = v_researcher;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
  UPDATE public.wallets SET pending_balance = pending_balance + v_net, total_earned = total_earned + v_net, updated_at = now() WHERE id = v_wallet;
  INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
  SELECT v_wallet, 'bounty', v_net, balance, p_report, 'Bounty approved net of ' || v_fee_pct || '% platform fee (pending payment)', v_uid FROM public.wallets WHERE id = v_wallet;
  UPDATE public.reports SET status = 'accepted', bounty_amount = v_net, updated_at = now() WHERE id = p_report;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'award', 'bounty_awards', v_award, jsonb_build_object('report_id', p_report, 'gross', p_amount, 'fee', v_fee, 'net', v_net));
  RETURN v_award;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.pay_award(p_award UUID, p_reference TEXT)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_amount NUMERIC; v_status TEXT; v_report UUID;
  v_researcher UUID; v_wallet UUID; v_program UUID; v_company UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT amount, status, report_id INTO v_amount, v_status, v_report FROM public.bounty_awards WHERE id = p_award;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  SELECT program_id, researcher_id INTO v_program, v_researcher FROM public.reports WHERE id = v_report;
  SELECT company_id INTO v_company FROM public.programs WHERE id = v_program;
  IF NOT (
    public.has_company_permission(v_company, 'manage_payouts')
    OR public.has_role('admin')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_status = 'paid' THEN RAISE EXCEPTION 'already paid'; END IF;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'award not approved'; END IF;
  IF p_reference IS NULL OR char_length(trim(p_reference)) = 0 THEN RAISE EXCEPTION 'reference required'; END IF;
  UPDATE public.bounty_awards SET status = 'paid', decided_at = now() WHERE id = p_award;
  INSERT INTO public.bounty_payments(award_id, amount, status, reference, processed_by)
  VALUES (p_award, v_amount, 'completed', trim(p_reference), v_uid);
  SELECT id INTO v_wallet FROM public.wallets WHERE researcher_id = v_researcher;
  IF v_wallet IS NOT NULL THEN
    UPDATE public.wallets SET balance = balance + v_amount,
      pending_balance = GREATEST(0, pending_balance - v_amount), updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
    SELECT v_wallet, 'bounty', v_amount, balance, p_award, 'Bounty paid (ref ' || trim(p_reference) || ')', v_uid FROM public.wallets WHERE id = v_wallet;
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'payout', 'bounty_awards', p_award, jsonb_build_object('amount', v_amount, 'reference', trim(p_reference)));
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 18.10 Admin tooling under RLS (P1 — functional fix)
-- Admin ban/unban (profiles.is_active) was silently blocked by
-- profiles_own_update; role management (user_roles upsert/delete)
-- had no admin policy at all. Both now run under has_role('admin')
-- — the same check the app performs server-side.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
CREATE POLICY "profiles_own_update" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.has_role('admin'))
  WITH CHECK (auth.uid() = id OR public.has_role('admin'));

DROP POLICY IF EXISTS "roles_admin_read" ON public.user_roles;
CREATE POLICY "roles_admin_read" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role('admin') OR public.has_role('moderator'));
DROP POLICY IF EXISTS "roles_self_insert" ON public.user_roles;
CREATE POLICY "roles_self_insert" ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role IN ('researcher','company'));
DROP POLICY IF EXISTS "roles_admin_write" ON public.user_roles;
CREATE POLICY "roles_admin_write" ON public.user_roles FOR UPDATE
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
DROP POLICY IF EXISTS "roles_admin_delete" ON public.user_roles;
CREATE POLICY "roles_admin_delete" ON public.user_roles FOR DELETE
  USING (public.has_role('admin') AND user_id <> auth.uid());

-- ------------------------------------------------------------
-- 18.11 conversations: prevent created_by spoofing (P2)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "conv_insert" ON public.conversations;
CREATE POLICY "conv_insert" ON public.conversations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

-- ------------------------------------------------------------
-- 18.12 SECURITY DEFINER hygiene: pin search_path (P2)
-- ------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.fn);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 18.13 Company researcher analytics helper (perf)
-- Aggregates researchers who submitted to a company's programs
-- in the database instead of fetching 2000 rows client-side.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.company_researcher_stats(p_company UUID)
RETURNS TABLE (
  researcher_id UUID,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  reports_count BIGINT,
  accepted_count BIGINT,
  total_awarded NUMERIC
) AS $$
  SELECT rp.id, rp.user_id, pr.username, rp.display_name, pr.avatar_url,
         COUNT(r.id)::BIGINT,
         COUNT(r.id) FILTER (WHERE r.status IN ('accepted','resolved'))::BIGINT,
         COALESCE(SUM(r.bounty_amount) FILTER (WHERE r.status IN ('accepted','resolved')), 0)
  FROM public.reports r
  JOIN public.researcher_profiles rp ON rp.id = r.researcher_id
  JOIN public.profiles pr ON pr.id = rp.user_id
  JOIN public.programs p ON p.id = r.program_id
  WHERE p.company_id = p_company
    AND (
      public.has_role('admin')
      OR EXISTS(SELECT 1 FROM public.company_profiles cp WHERE cp.id = p_company AND cp.owner_id = auth.uid())
      OR EXISTS(SELECT 1 FROM public.company_members cm WHERE cm.company_id = p_company AND cm.user_id = auth.uid())
    )
  GROUP BY rp.id, rp.user_id, pr.username, rp.display_name, pr.avatar_url
  ORDER BY COUNT(r.id) DESC
  LIMIT 100;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

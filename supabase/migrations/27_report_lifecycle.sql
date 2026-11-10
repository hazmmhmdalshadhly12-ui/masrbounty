-- ============================================================
-- 27. PROFESSIONAL REPORT LIFECYCLE (idempotent)
-- Hardens the vulnerability-report state machine end to end:
--   * P0 FIX: researchers could never submit their own draft —
--     trg_protect_report_triage blocked the legitimate
--     draft → submitted transition. Fixed below.
--   * 'spam' added to report_status (professional triage taxonomies).
--   * Authoritative from → to transition map enforced by a DB
--     trigger, mirroring constants/statuses.ts REPORT_TRANSITIONS.
--     Unknown source statuses are rejected (no more "unknown = allow").
--     Reopening closed reports is staff-only.
--   * Evidence integrity: original report content is immutable after
--     submission (reporters may refine content only while a draft;
--     companies may never rewrite the original text; severity keeps
--     its own audited company flow).
--   * Reference numbers gain a year segment: MB-YYYY-000001
--     (existing MB-000001 numbers remain valid and unique).
--   * rep_insert now re-checks program active + visibility/invitation
--     at the DATABASE level (blocks direct-SDK inserts into
--     draft/closed/private programs — IDOR hardening).
--   * Indexes for the inbox/list sort paths (submitted_at, updated_at).
-- All changes are ADDITIVE — no data is dropped or rewritten.
-- ============================================================

-- 27.1 'spam' enum value -------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'report_status' AND e.enumlabel = 'spam') THEN
    ALTER TYPE public.report_status ADD VALUE 'spam';
  END IF;
END $$;

-- 27.2 Reference number with year segment --------------------
CREATE OR REPLACE FUNCTION public.generate_report_number() RETURNS TEXT AS $$
DECLARE n BIGINT;
BEGIN
  n := nextval('report_number_seq');
  RETURN 'MB-' || to_char(now(), 'YYYY') || '-' || lpad(n::TEXT, 6, '0');
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 27.3 P0 FIX + transition enforcement (one BEFORE UPDATE trigger)
-- Replaces protect_report_triage_fields with a version that keeps the
-- triage-field guard but lets the reporter submit their own draft.
CREATE OR REPLACE FUNCTION public.protect_report_triage_fields() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.severity IS DISTINCT FROM OLD.severity
     OR NEW.bounty_amount IS DISTINCT FROM OLD.bounty_amount THEN

    -- P0 FIX: the reporter may legitimately submit their own draft
    -- (status-only change, no severity/bounty tampering).
    IF OLD.status = 'draft' AND NEW.status = 'submitted'
       AND NEW.severity IS NOT DISTINCT FROM OLD.severity
       AND NEW.bounty_amount IS NOT DISTINCT FROM OLD.bounty_amount
       AND EXISTS(
         SELECT 1 FROM public.researcher_profiles rp
         WHERE rp.id = NEW.researcher_id AND rp.user_id = auth.uid()
       ) THEN
      RETURN NEW;
    END IF;

    IF public.has_role('admin') OR public.has_role('moderator')
       OR EXISTS(
         SELECT 1 FROM public.programs p
         WHERE p.id = NEW.program_id
           AND public.company_role(p.company_id, auth.uid())
               IN ('owner','admin','triager','finance')
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

-- 27.4 Lifecycle transition map (mirrors constants/statuses.ts) --
CREATE OR REPLACE FUNCTION public.fn_enforce_report_transitions() RETURNS TRIGGER AS $$
DECLARE
  v_allowed TEXT[];
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  -- Drafts are created, never re-entered.
  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'invalid transition: % → draft', OLD.status;
  END IF;

  v_allowed := CASE OLD.status
    WHEN 'draft'           THEN ARRAY['submitted']
    WHEN 'submitted'       THEN ARRAY['under_review','triaged','need_more_info','accepted',
                                      'informative','duplicate','not_applicable','rejected','spam','closed']
    WHEN 'under_review'    THEN ARRAY['triaged','need_more_info','accepted','informative',
                                      'duplicate','not_applicable','rejected','spam','closed']
    WHEN 'need_more_info'  THEN ARRAY['under_review','triaged','accepted','informative',
                                      'duplicate','not_applicable','rejected','spam','closed']
    WHEN 'triaged'         THEN ARRAY['under_review','need_more_info','accepted','informative',
                                      'duplicate','not_applicable','rejected','spam','resolved','closed']
    WHEN 'accepted'        THEN ARRAY['reward_approved','resolved','closed']
    WHEN 'reward_approved' THEN ARRAY['paid','accepted']
    WHEN 'rejected'        THEN ARRAY['closed']
    WHEN 'informative'     THEN ARRAY['closed']
    WHEN 'duplicate'       THEN ARRAY['closed']
    WHEN 'not_applicable'  THEN ARRAY['closed']
    WHEN 'spam'            THEN ARRAY['closed']
    WHEN 'resolved'        THEN ARRAY['closed']
    WHEN 'paid'            THEN ARRAY['closed']
    WHEN 'closed'          THEN ARRAY[]::TEXT[]  -- reopen = staff-only override below
    ELSE ARRAY[]::TEXT[]                        -- unknown source status: deny everything
  END;

  IF NOT (NEW.status = ANY(v_allowed)) THEN
    -- Staff-only reopen of closed reports.
    IF OLD.status = 'closed' AND NEW.status = 'under_review'
       AND (public.has_role('admin') OR public.has_role('moderator')) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'invalid transition: % → %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_report_transitions ON public.reports;
CREATE TRIGGER trg_report_transitions BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_report_transitions();

-- 27.5 Evidence integrity: content immutability after submission
CREATE OR REPLACE FUNCTION public.fn_protect_report_content() RETURNS TRIGGER AS $$
DECLARE
  v_is_reporter BOOLEAN;
  v_company_rank TEXT;
  v_severity_only BOOLEAN;
BEGIN
  IF NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.summary IS NOT DISTINCT FROM OLD.summary
     AND NEW.vulnerability_type IS NOT DISTINCT FROM OLD.vulnerability_type
     AND NEW.severity IS NOT DISTINCT FROM OLD.severity
     AND NEW.affected_asset IS NOT DISTINCT FROM OLD.affected_asset
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.impact IS NOT DISTINCT FROM OLD.impact
     AND NEW.reproduction_steps IS NOT DISTINCT FROM OLD.reproduction_steps
     AND NEW.remediation IS NOT DISTINCT FROM OLD.remediation
     AND NEW.cvss_score IS NOT DISTINCT FROM OLD.cvss_score
     AND NEW.cwe IS NOT DISTINCT FROM OLD.cwe
     AND NEW.program_id IS NOT DISTINCT FROM OLD.program_id
     AND NEW.asset_id IS NOT DISTINCT FROM OLD.asset_id THEN
    RETURN NEW; -- no original-content change
  END IF;

  -- Staff (admin/moderator) may correct content; every such change is
  -- already audit-logged by the calling server actions.
  IF public.has_role('admin') OR public.has_role('moderator') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.researcher_profiles rp
    WHERE rp.id = NEW.researcher_id AND rp.user_id = auth.uid()
  ) INTO v_is_reporter;

  SELECT public.company_role(p.company_id, auth.uid())
    INTO v_company_rank
    FROM public.programs p WHERE p.id = NEW.program_id;

  -- Reporter may refine content ONLY while still a draft.
  IF v_is_reporter THEN
    IF OLD.status = 'draft' AND NEW.status = 'draft' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'forbidden: report content is locked after submission — use comments/clarifications';
  END IF;

  -- Severity-only change by company triage rank+ keeps its existing
  -- audited flow (changeSeverityAction requires a reason; the old
  -- triage-fields trigger still guards the rank).
  v_severity_only :=
       NEW.title IS NOT DISTINCT FROM OLD.title
   AND NEW.summary IS NOT DISTINCT FROM OLD.summary
   AND NEW.vulnerability_type IS NOT DISTINCT FROM OLD.vulnerability_type
   AND NEW.affected_asset IS NOT DISTINCT FROM OLD.affected_asset
   AND NEW.description IS NOT DISTINCT FROM OLD.description
   AND NEW.impact IS NOT DISTINCT FROM OLD.impact
   AND NEW.reproduction_steps IS NOT DISTINCT FROM OLD.reproduction_steps
   AND NEW.remediation IS NOT DISTINCT FROM OLD.remediation
   AND NEW.cvss_score IS NOT DISTINCT FROM OLD.cvss_score
   AND NEW.cwe IS NOT DISTINCT FROM OLD.cwe
   AND NEW.program_id IS NOT DISTINCT FROM OLD.program_id
   AND NEW.asset_id IS NOT DISTINCT FROM OLD.asset_id;

  IF v_company_rank IN ('owner','admin','triager','finance') THEN
    IF v_severity_only THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'forbidden: original report content is immutable — evidence integrity';
  END IF;

  RAISE EXCEPTION 'forbidden: you cannot edit this report';
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_report_content ON public.reports;
CREATE TRIGGER trg_protect_report_content BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_report_content();

-- 27.6 rep_insert: program must be active AND reachable by the researcher
DROP POLICY IF EXISTS "rep_insert" ON public.reports;
CREATE POLICY "rep_insert" ON public.reports FOR INSERT WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.researcher_profiles rp
    WHERE rp.id = researcher_id AND rp.user_id = auth.uid()
  )
  AND EXISTS(
    SELECT 1 FROM public.programs p
    WHERE p.id = program_id
      AND p.status = 'active'
      AND (
        p.visibility = 'public'
        OR EXISTS(
          SELECT 1 FROM public.program_researchers pri
          WHERE pri.program_id = p.id
            AND pri.researcher_id = researcher_id
            AND pri.status = 'accepted'
        )
      )
  )
);

-- 27.7 Inbox/list indexes
CREATE INDEX IF NOT EXISTS idx_reports_submitted_at ON public.reports(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON public.reports(updated_at DESC);

-- 27.8 award_bounty: never downgrade a decided report.
-- The legacy RPC set reports.status='accepted' unconditionally, which under
-- the new transition map would raise (resolved → accepted is a regression).
-- The final UPDATE is now guarded: the status flips forward into 'accepted'
-- only from pre-decision states; resolved/closed reports keep their state.
CREATE OR REPLACE FUNCTION public.award_bounty(p_report UUID, p_amount NUMERIC)
RETURNS UUID AS $$
DECLARE v_program UUID; v_company UUID; v_researcher UUID; v_uid UUID;
  v_wallet UUID; v_award UUID; v_existing TEXT; v_report_no TEXT;
  v_fee_pct NUMERIC; v_fee NUMERIC; v_net NUMERIC;
  v_cwallet UUID; v_cbalance NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  -- F3: FOR UPDATE serializes concurrent awards for the same report
  SELECT program_id, researcher_id INTO v_program, v_researcher
    FROM public.reports WHERE id = p_report FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  SELECT company_id INTO v_company FROM public.programs WHERE id = v_program;
  IF NOT (
    public.has_company_permission(v_company, 'triage')
    OR public.has_role('admin')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  SELECT status INTO v_existing FROM public.bounty_awards WHERE report_id = p_report;
  IF v_existing IN ('approved','paid') THEN RAISE EXCEPTION 'already awarded'; END IF;
  -- Platform commission (configurable, default 10%). Researcher receives the net.
  SELECT COALESCE((value->>'percent')::NUMERIC, (value)::NUMERIC, 10) INTO v_fee_pct
    FROM public.platform_settings WHERE key = 'platform_fee' LIMIT 1;
  IF v_fee_pct IS NULL THEN v_fee_pct := 10; END IF;
  v_fee_pct := GREATEST(0, LEAST(50, v_fee_pct));
  v_fee := round(p_amount * v_fee_pct / 100, 2);
  v_net := p_amount - v_fee;
  -- PREPAID: debit the company wallet for the gross amount (row-locked)
  IF p_amount > 0 THEN
    INSERT INTO public.company_wallets(company_id) VALUES (v_company) ON CONFLICT (company_id) DO NOTHING;
    SELECT id, balance INTO v_cwallet, v_cbalance FROM public.company_wallets WHERE company_id = v_company FOR UPDATE;
    IF v_cwallet IS NULL THEN RAISE EXCEPTION 'company wallet missing'; END IF;
    IF v_cbalance < p_amount THEN RAISE EXCEPTION 'insufficient company balance'; END IF;
    UPDATE public.company_wallets
      SET balance = balance - p_amount, total_spent = total_spent + p_amount, updated_at = now()
      WHERE id = v_cwallet;
  ELSE
    SELECT id INTO v_cwallet FROM public.company_wallets WHERE company_id = v_company;
  END IF;
  INSERT INTO public.bounty_awards(report_id, amount, status, awarded_by)
  VALUES (p_report, v_net, 'approved', v_uid)
  ON CONFLICT (report_id) DO UPDATE SET amount = v_net, status = 'approved', awarded_by = v_uid
  RETURNING id INTO v_award;
  INSERT INTO public.platform_revenue(award_id, gross_amount, fee_percent, fee_amount, net_amount)
  VALUES (v_award, p_amount, v_fee_pct, v_fee, v_net)
  ON CONFLICT (award_id) DO UPDATE SET gross_amount = p_amount, fee_percent = v_fee_pct, fee_amount = v_fee, net_amount = v_net;
  -- Company ledger entry
  IF p_amount > 0 AND v_cwallet IS NOT NULL THEN
    SELECT report_number INTO v_report_no FROM public.reports WHERE id = p_report;
    INSERT INTO public.company_wallet_transactions(company_wallet_id, type, amount, balance_after, reference_id, note, created_by)
    VALUES (v_cwallet, 'bounty', -p_amount, v_cbalance - p_amount, p_report,
      'تمويل مكافأة التقرير ' || COALESCE(v_report_no, ''), v_uid);
  END IF;
  SELECT id INTO v_wallet FROM public.wallets WHERE researcher_id = v_researcher;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
  UPDATE public.wallets SET pending_balance = pending_balance + v_net, total_earned = total_earned + v_net, updated_at = now() WHERE id = v_wallet;
  INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
  SELECT v_wallet, 'bounty', v_net, balance, p_report, 'مكافأة معتمدة صافية بعد عمولة ' || v_fee_pct || '% (قيد الضمان حتى الصرف)', v_uid FROM public.wallets WHERE id = v_wallet;
  -- 27.8: guarded status flip — forward to 'accepted' only from pre-decision
  -- states; a resolved/closed report is never downgraded by an award.
  UPDATE public.reports SET status = 'accepted', bounty_amount = v_net, updated_at = now()
   WHERE id = p_report
     AND status IN ('submitted','under_review','need_more_info','triaged','accepted');
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'award', 'bounty_awards', v_award, jsonb_build_object('report_id', p_report, 'gross', p_amount, 'fee', v_fee, 'net', v_net));
  RETURN v_award;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

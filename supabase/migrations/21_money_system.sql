-- ============================================================
-- 21. PROFESSIONAL MONEY SYSTEM (idempotent)
-- Prepaid company wallets + deposit approvals + two-step payouts
-- + admin wallet adjustments + ledgers for every user type.
-- All money movement stays inside SECURITY DEFINER RPCs;
-- client JWTs still cannot move money directly.
--
-- Money flow (prepaid escrow model):
--   1) Company transfers EGP to the platform (Vodafone Cash etc.)
--      and files a deposit request.
--   2) Admin verifies the transfer -> company wallet credited.
--   3) Company awards a bounty -> gross debited from the company
--      wallet; platform fee stays with the platform; researcher
--      pending_balance credited with the net.
--   4) Company/admin releases the award -> researcher balance
--      becomes withdrawable (reference optional: no external
--      transfer is needed, funds are already held in escrow).
--   5) Researcher requests a payout -> admin approves (balance
--      debited, status=approved) -> admin completes with the
--      external transfer reference (status=completed), or cancels
--      (balance refunded, status=rejected).
--   6) Admin can credit/debit any wallet manually (adjust_wallet)
--      with a mandatory audit note.
-- ============================================================

-- 21.1 Enums -------------------------------------------------
DO $$ BEGIN
  CREATE TYPE deposit_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'txn_type' AND e.enumlabel = 'deposit'
  ) THEN
    ALTER TYPE public.txn_type ADD VALUE 'deposit';
  END IF;
END $$;

-- 21.2 Company wallets + ledger ------------------------------
CREATE TABLE IF NOT EXISTS public.company_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) DEFAULT 0 NOT NULL CHECK (balance >= 0),
  pending_balance NUMERIC(12,2) DEFAULT 0 NOT NULL CHECK (pending_balance >= 0),
  total_funded NUMERIC(12,2) DEFAULT 0 NOT NULL CHECK (total_funded >= 0),
  total_spent NUMERIC(12,2) DEFAULT 0 NOT NULL CHECK (total_spent >= 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.company_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_wallet_id UUID NOT NULL REFERENCES public.company_wallets(id) ON DELETE CASCADE,
  type txn_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount <> 0),
  balance_after NUMERIC(12,2) NOT NULL,
  reference_id UUID,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cwt_wallet ON public.company_wallet_transactions(company_wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_wallet_company ON public.company_wallets(company_id);

-- Every new company gets a wallet automatically
CREATE OR REPLACE FUNCTION public.ensure_company_wallet() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.company_wallets(company_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_company_wallet ON public.company_profiles;
CREATE TRIGGER trg_company_wallet AFTER INSERT ON public.company_profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_company_wallet();

-- Backfill wallets for companies created before this migration
INSERT INTO public.company_wallets(company_id)
SELECT id FROM public.company_profiles
ON CONFLICT (company_id) DO NOTHING;

ALTER TABLE public.company_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cw_select" ON public.company_wallets;
CREATE POLICY "cw_select" ON public.company_wallets FOR SELECT
USING (public.has_role('admin') OR public.company_role(company_id, auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "cwt_select" ON public.company_wallet_transactions;
CREATE POLICY "cwt_select" ON public.company_wallet_transactions FOR SELECT
USING (
  public.has_role('admin')
  OR EXISTS(
    SELECT 1 FROM public.company_wallets cw
    WHERE cw.id = company_wallet_id
      AND public.company_role(cw.company_id, auth.uid()) IS NOT NULL
  )
);
-- No INSERT/UPDATE/DELETE policies: wallet money moves only through
-- the SECURITY DEFINER RPCs below (service role inside the app).

-- 21.3 Deposit requests --------------------------------------
CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('vodafone_cash','instapay','bank','other')),
  sender_name TEXT,
  reference TEXT NOT NULL,
  note TEXT,
  status deposit_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deposit_company ON public.deposit_requests(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_pending ON public.deposit_requests(status, created_at) WHERE status = 'pending';

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dr_select" ON public.deposit_requests;
CREATE POLICY "dr_select" ON public.deposit_requests FOR SELECT
USING (public.has_role('admin') OR public.company_role(company_id, auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "dr_insert" ON public.deposit_requests;
CREATE POLICY "dr_insert" ON public.deposit_requests FOR INSERT
WITH CHECK (status = 'pending' AND public.has_company_permission(company_id, 'manage_payouts'));

DROP POLICY IF EXISTS "dr_admin_update" ON public.deposit_requests;
CREATE POLICY "dr_admin_update" ON public.deposit_requests FOR UPDATE
USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

-- 21.4 Deposit review (admin) --------------------------------
CREATE OR REPLACE FUNCTION public.review_deposit(p_deposit UUID, p_approve BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_row RECORD; v_wallet UUID; v_nb NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.deposit_requests WHERE id = p_deposit;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'already decided'; END IF;
  IF p_approve THEN
    INSERT INTO public.company_wallets(company_id) VALUES (v_row.company_id) ON CONFLICT (company_id) DO NOTHING;
    SELECT id, balance INTO v_wallet, v_nb FROM public.company_wallets WHERE company_id = v_row.company_id FOR UPDATE;
    IF v_wallet IS NULL THEN RAISE EXCEPTION 'company wallet missing'; END IF;
    v_nb := v_nb + v_row.amount;
    UPDATE public.company_wallets
      SET balance = v_nb, total_funded = total_funded + v_row.amount, updated_at = now()
      WHERE id = v_wallet;
    INSERT INTO public.company_wallet_transactions(company_wallet_id, type, amount, balance_after, reference_id, note, created_by)
    VALUES (v_wallet, 'deposit', v_row.amount, v_nb, p_deposit,
      'إيداع معتمد' || COALESCE(NULLIF(' — مرجع ' || trim(v_row.reference), ' — مرجع '), ''), v_uid);
    UPDATE public.deposit_requests
      SET status = 'approved', reviewed_by = v_uid, review_note = p_note, updated_at = now()
      WHERE id = p_deposit;
  ELSE
    UPDATE public.deposit_requests
      SET status = 'rejected', reviewed_by = v_uid, review_note = p_note, updated_at = now()
      WHERE id = p_deposit;
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'deposit', 'deposit_requests', p_deposit,
    jsonb_build_object('approved', p_approve, 'amount', v_row.amount, 'company', v_row.company_id, 'note', p_note));
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 21.5 Admin manual wallet adjustment (full control) ----------
CREATE OR REPLACE FUNCTION public.adjust_wallet(p_subject TEXT, p_id UUID, p_amount NUMERIC, p_note TEXT)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_wallet UUID; v_nb NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF p_note IS NULL OR char_length(trim(p_note)) < 3 THEN RAISE EXCEPTION 'note required'; END IF;
  IF p_subject = 'researcher' THEN
    INSERT INTO public.wallets(researcher_id) VALUES (p_id) ON CONFLICT (researcher_id) DO NOTHING;
    SELECT id, balance INTO v_wallet, v_nb FROM public.wallets WHERE researcher_id = p_id FOR UPDATE;
    IF v_wallet IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
    IF v_nb + p_amount < 0 THEN RAISE EXCEPTION 'insufficient balance'; END IF;
    UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
    VALUES (v_wallet, 'adjustment', p_amount, v_nb + p_amount, NULL, 'تسوية إدارية: ' || trim(p_note), v_uid);
    INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
    VALUES (v_uid, 'adjust', 'wallets', v_wallet, jsonb_build_object('researcher', p_id, 'amount', p_amount, 'note', trim(p_note)));
  ELSIF p_subject = 'company' THEN
    INSERT INTO public.company_wallets(company_id) VALUES (p_id) ON CONFLICT (company_id) DO NOTHING;
    SELECT id, balance INTO v_wallet, v_nb FROM public.company_wallets WHERE company_id = p_id FOR UPDATE;
    IF v_wallet IS NULL THEN RAISE EXCEPTION 'company wallet missing'; END IF;
    IF v_nb + p_amount < 0 THEN RAISE EXCEPTION 'insufficient balance'; END IF;
    UPDATE public.company_wallets SET balance = balance + p_amount, updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.company_wallet_transactions(company_wallet_id, type, amount, balance_after, reference_id, note, created_by)
    VALUES (v_wallet, 'adjustment', p_amount, v_nb + p_amount, NULL, 'تسوية إدارية: ' || trim(p_note), v_uid);
    INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
    VALUES (v_uid, 'adjust', 'company_wallets', v_wallet, jsonb_build_object('company', p_id, 'amount', p_amount, 'note', trim(p_note)));
  ELSE
    RAISE EXCEPTION 'invalid subject';
  END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 21.6 award_bounty v3: prepaid debit from the company wallet -
CREATE OR REPLACE FUNCTION public.award_bounty(p_report UUID, p_amount NUMERIC)
RETURNS UUID AS $$
DECLARE v_program UUID; v_company UUID; v_researcher UUID; v_uid UUID;
  v_wallet UUID; v_award UUID; v_existing TEXT; v_report_no TEXT;
  v_fee_pct NUMERIC; v_fee NUMERIC; v_net NUMERIC;
  v_cwallet UUID; v_cbalance NUMERIC;
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
  UPDATE public.reports SET status = 'accepted', bounty_amount = v_net, updated_at = now() WHERE id = p_report;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'award', 'bounty_awards', v_award, jsonb_build_object('report_id', p_report, 'gross', p_amount, 'fee', v_fee, 'net', v_net));
  RETURN v_award;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 21.7 pay_award v3: release escrow, reference optional -------
CREATE OR REPLACE FUNCTION public.pay_award(p_award UUID, p_reference TEXT)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_amount NUMERIC; v_status TEXT; v_report UUID;
  v_researcher UUID; v_wallet UUID; v_program UUID; v_company UUID; v_ref TEXT;
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
  -- Funds are already held in escrow (company wallet was debited at
  -- award time), so an external reference is optional — when given
  -- it is recorded for the audit trail.
  IF p_reference IS NULL OR char_length(trim(p_reference)) = 0 THEN
    v_ref := NULL;
  ELSE
    v_ref := trim(p_reference);
  END IF;
  UPDATE public.bounty_awards SET status = 'paid', decided_at = now() WHERE id = p_award;
  INSERT INTO public.bounty_payments(award_id, amount, status, reference, processed_by)
  VALUES (p_award, v_amount, 'completed', v_ref, v_uid);
  SELECT id INTO v_wallet FROM public.wallets WHERE researcher_id = v_researcher;
  IF v_wallet IS NOT NULL THEN
    UPDATE public.wallets SET balance = balance + v_amount,
      pending_balance = GREATEST(0, pending_balance - v_amount), updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
    SELECT v_wallet, 'bounty', v_amount, balance, p_award,
      'تم صرف المكافأة إلى رصيدك المتاح' || COALESCE(NULLIF(' (مرجع ' || v_ref || ')', ' (مرجع )'), ''), v_uid
      FROM public.wallets WHERE id = v_wallet;
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'payout', 'bounty_awards', p_award, jsonb_build_object('amount', v_amount, 'reference', v_ref));
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 21.8 settle_payout v3: true two-step payout -----------------
CREATE OR REPLACE FUNCTION public.settle_payout(p_payout UUID, p_approve BOOLEAN)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_row RECORD; v_wallet UUID; v_nb NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.payout_requests WHERE id = p_payout;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v_row.status = 'pending' AND p_approve THEN
    -- Step 1: approve -> debit balance, await the external transfer
    SELECT id, balance INTO v_wallet, v_nb FROM public.wallets WHERE researcher_id = v_row.researcher_id;
    IF v_wallet IS NULL OR v_nb < v_row.amount THEN RAISE EXCEPTION 'insufficient balance'; END IF;
    v_nb := v_nb - v_row.amount;
    UPDATE public.wallets SET balance = v_nb, updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
    VALUES (v_wallet, 'payout', -v_row.amount, v_nb, p_payout, 'تم اعتماد السحب — قيد التحويل', v_uid);
    UPDATE public.payout_requests SET status = 'approved', reviewed_by = v_uid, updated_at = now() WHERE id = p_payout;
  ELSIF v_row.status = 'pending' AND NOT p_approve THEN
    UPDATE public.payout_requests SET status = 'rejected', reviewed_by = v_uid, updated_at = now() WHERE id = p_payout;
  ELSIF v_row.status = 'approved' AND NOT p_approve THEN
    -- Cancel an approved payout -> refund the reserved amount
    SELECT id, balance INTO v_wallet, v_nb FROM public.wallets WHERE researcher_id = v_row.researcher_id;
    IF v_wallet IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
    UPDATE public.wallets SET balance = balance + v_row.amount, updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
    SELECT v_wallet, 'payout', v_row.amount, balance, p_payout, 'استرداد طلب سحب ملغي', v_uid FROM public.wallets WHERE id = v_wallet;
    UPDATE public.payout_requests SET status = 'rejected', reviewed_by = v_uid, updated_at = now() WHERE id = p_payout;
  ELSE
    RAISE EXCEPTION 'already decided';
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'payout', 'payout_requests', p_payout,
    jsonb_build_object('approved', p_approve, 'amount', v_row.amount, 'from_status', v_row.status));
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 21.9 More ledger indexes ------------------------------------
CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet ON public.wallet_transactions(wallet_id, created_at DESC);

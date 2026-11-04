-- ============================================================
-- 22. MONEY RACE-CONDITION & RLS HARDENING (idempotent)
-- Fixes found in the code/DB review of the money system:
--
--   F1  payout_requests.pr_insert did not force status='pending'.
--       A researcher could insert a payout row directly with
--       status='approved' (INSERT policy only checked ownership).
--       An admin pressing "cancel & refund" on that forged row
--       credited a balance that was never debited (money printing).
--       -> policy now forces status='pending' (mirrors dr_insert).
--
--   F2  settle_payout refund path now verifies a real debit ledger
--       entry exists for the payout before refunding (defense in
--       depth: no refund without a matching negative 'payout' txn).
--
--   F3  Row locks (SELECT ... FOR UPDATE) added so concurrent
--       double-clicks / parallel calls can never:
--         - approve the same payout twice        (settle_payout)
--         - read the same wallet balance twice   (settle_payout:
--           lost update -> two payouts, one debit)
--         - credit the same deposit twice        (review_deposit)
--         - award the same report twice (double debit from the
--           company wallet)                      (award_bounty)
--         - pay the same award twice + duplicate
--           bounty_payments rows                 (pay_award)
--
--   F4  pay_award no longer silently skips a missing researcher
--       wallet: an award can never be marked 'paid' without the
--       researcher actually being credited.
--
-- All rewritten functions keep their exact previous behavior and
-- guarantees (see tests/security/workflow-money.test.ts) and stay
-- SECURITY DEFINER with pinned search_path.
-- ============================================================

-- 22.1 F1: payout INSERT must be pending + own researcher -------
DROP POLICY IF EXISTS "pr_insert" ON public.payout_requests;
CREATE POLICY "pr_insert" ON public.payout_requests FOR INSERT
WITH CHECK (
  status = 'pending'
  AND EXISTS(
    SELECT 1 FROM public.researcher_profiles rp
    WHERE rp.id = researcher_id AND rp.user_id = auth.uid()
  )
);

-- 22.2 F3+F4: award_bounty — lock the report row first so two
-- concurrent awards for the same report serialize; the loser then
-- re-reads bounty_awards and hits 'already awarded' before any
-- second debit leaves the company wallet.
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
  UPDATE public.reports SET status = 'accepted', bounty_amount = v_net, updated_at = now() WHERE id = p_report;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'award', 'bounty_awards', v_award, jsonb_build_object('report_id', p_report, 'gross', p_amount, 'fee', v_fee, 'net', v_net));
  RETURN v_award;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 22.3 F3+F4: pay_award — lock the award row (no double pay, no
-- duplicate bounty_payments) and refuse to pay into a missing wallet.
CREATE OR REPLACE FUNCTION public.pay_award(p_award UUID, p_reference TEXT)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_amount NUMERIC; v_status TEXT; v_report UUID;
  v_researcher UUID; v_wallet UUID; v_program UUID; v_company UUID; v_ref TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  -- F3: FOR UPDATE serializes concurrent payments of the same award
  SELECT amount, status, report_id INTO v_amount, v_status, v_report
    FROM public.bounty_awards WHERE id = p_award FOR UPDATE;
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
  -- F4: never mark an award paid without actually crediting the researcher
  SELECT id INTO v_wallet FROM public.wallets WHERE researcher_id = v_researcher FOR UPDATE;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
  UPDATE public.wallets SET balance = balance + v_amount,
    pending_balance = GREATEST(0, pending_balance - v_amount), updated_at = now() WHERE id = v_wallet;
  INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
  SELECT v_wallet, 'bounty', v_amount, balance, p_award,
    'تم صرف المكافأة إلى رصيدك المتاح' || COALESCE(NULLIF(' (مرجع ' || v_ref || ')', ' (مرجع )'), ''), v_uid
    FROM public.wallets WHERE id = v_wallet;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'payout', 'bounty_awards', p_award, jsonb_build_object('amount', v_amount, 'reference', v_ref));
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 22.4 F2+F3: settle_payout — lock the payout row AND the wallet
-- row; refunds require proof of the original debit.
CREATE OR REPLACE FUNCTION public.settle_payout(p_payout UUID, p_approve BOOLEAN)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_row RECORD; v_wallet UUID; v_nb NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  -- F3: FOR UPDATE makes double-click / parallel decisions impossible
  SELECT * INTO v_row FROM public.payout_requests WHERE id = p_payout FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v_row.status = 'pending' AND p_approve THEN
    -- Step 1: approve -> debit balance, await the external transfer
    SELECT id, balance INTO v_wallet, v_nb FROM public.wallets WHERE researcher_id = v_row.researcher_id FOR UPDATE;
    IF v_wallet IS NULL OR v_nb < v_row.amount THEN RAISE EXCEPTION 'insufficient balance'; END IF;
    v_nb := v_nb - v_row.amount;
    UPDATE public.wallets SET balance = v_nb, updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.wallet_transactions(wallet_id, type, amount, balance_after, reference_id, note, created_by)
    VALUES (v_wallet, 'payout', -v_row.amount, v_nb, p_payout, 'تم اعتماد السحب — قيد التحويل', v_uid);
    UPDATE public.payout_requests SET status = 'approved', reviewed_by = v_uid, updated_at = now() WHERE id = p_payout;
  ELSIF v_row.status = 'pending' AND NOT p_approve THEN
    UPDATE public.payout_requests SET status = 'rejected', reviewed_by = v_uid, updated_at = now() WHERE id = p_payout;
  ELSIF v_row.status = 'approved' AND NOT p_approve THEN
    -- Cancel an approved payout -> refund the reserved amount.
    -- F2: refund ONLY if the approval actually debited the wallet
    -- (blocks forged 'approved' rows from printing money).
    IF NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions
      WHERE reference_id = p_payout AND type = 'payout' AND amount < 0
    ) THEN
      RAISE EXCEPTION 'no debit to refund';
    END IF;
    SELECT id, balance INTO v_wallet, v_nb FROM public.wallets WHERE researcher_id = v_row.researcher_id FOR UPDATE;
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

-- 22.5 F3: review_deposit — lock the deposit row so a double
-- click on approve/reject can never credit the wallet twice.
CREATE OR REPLACE FUNCTION public.review_deposit(p_deposit UUID, p_approve BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_row RECORD; v_wallet UUID; v_nb NUMERIC;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  -- F3: FOR UPDATE serializes concurrent decisions on one deposit
  SELECT * INTO v_row FROM public.deposit_requests WHERE id = p_deposit FOR UPDATE;
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

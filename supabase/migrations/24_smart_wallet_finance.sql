-- ============================================================
-- 24. SMART WALLET & FINANCE SYSTEM (idempotent)
-- Ledger-based accounting with INTEGER minor currency units
-- (piastres = 1/100 EGP). No floating point in the money core.
--
-- Architecture:
--   * company_wallets gains integer minor-unit columns:
--       available_balance_minor / reserved_balance_minor.
--   * Every money movement writes one row into wallet_transactions
--       (idempotency_key UNIQUE) and a BALANCED set of entries into
--       financial_ledger_entries (sum(debit) = sum(credit) per txn).
--   * Commission rate is never hardcoded: resolved from
--       commission_settings (company override > global), seeded once
--       at 2000 bp (20%). The effective rate is LOCKED into the
--       bounty_rewards row at approval time.
--   * Rewards reserve funds from the company wallet at approval and
--       release them only when an admin marks the payout PAID.
--   * Failed/cancelled payouts MUST refund the reservation.
--   * All movement lives in SECURITY DEFINER RPCs with row locks
--       and status-guarded transitions (idempotent, race-safe).
--   * Ledger + transactions + audit tables are APPEND-ONLY
--       (mutation-blocking triggers, no client write policies).
-- ============================================================

-- 24.1 Enums -------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.reward_state AS ENUM
    ('reward_approved','awaiting_payout','processing','paid','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.commission_scope AS ENUM ('global','company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_entry_type AS ENUM ('debit','credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Report lifecycle extension (additive only; existing values untouched):
-- under_review / need_more_info / rejected / reward_approved / paid
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 WHERE t.typname='report_status' AND e.enumlabel='under_review') THEN
    ALTER TYPE public.report_status ADD VALUE 'under_review';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 WHERE t.typname='report_status' AND e.enumlabel='need_more_info') THEN
    ALTER TYPE public.report_status ADD VALUE 'need_more_info';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 WHERE t.typname='report_status' AND e.enumlabel='rejected') THEN
    ALTER TYPE public.report_status ADD VALUE 'rejected';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 WHERE t.typname='report_status' AND e.enumlabel='reward_approved') THEN
    ALTER TYPE public.report_status ADD VALUE 'reward_approved';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 WHERE t.typname='report_status' AND e.enumlabel='paid') THEN
    ALTER TYPE public.report_status ADD VALUE 'paid';
  END IF;
END $$;

-- 24.2 company_wallets: integer minor-unit columns -----------
ALTER TABLE public.company_wallets
  ADD COLUMN IF NOT EXISTS available_balance_minor BIGINT NOT NULL DEFAULT 0 CHECK (available_balance_minor >= 0);
ALTER TABLE public.company_wallets
  ADD COLUMN IF NOT EXISTS reserved_balance_minor BIGINT NOT NULL DEFAULT 0 CHECK (reserved_balance_minor >= 0);
ALTER TABLE public.company_wallets
  ADD COLUMN IF NOT EXISTS total_deposits_minor BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.company_wallets
  ADD COLUMN IF NOT EXISTS total_rewards_minor BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.company_wallets
  ADD COLUMN IF NOT EXISTS total_fees_minor BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.company_wallets
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EGP' CHECK (currency = 'EGP');

-- One-time migration of the legacy NUMERIC balance into minor units
-- (exact: piastres = balance * 100). Only fills rows still untouched.
UPDATE public.company_wallets
   SET available_balance_minor = GREATEST(0, ROUND(balance * 100)::BIGINT)
 WHERE available_balance_minor = 0 AND reserved_balance_minor = 0 AND balance > 0;

-- 24.3 wallet_deposit_requests (apply -> admin verifies -> credit ONCE)
CREATE TABLE IF NOT EXISTS public.wallet_deposit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'EGP' CHECK (currency = 'EGP'),
  method TEXT NOT NULL CHECK (method IN ('vodafone_cash','instapay','bank','other')),
  reference TEXT NOT NULL,
  sender_name TEXT,
  proof_url TEXT,
  note TEXT,
  status public.deposit_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  transaction_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wdr_company ON public.wallet_deposit_requests(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wdr_pending ON public.wallet_deposit_requests(status, created_at) WHERE status = 'pending';

-- 24.4 wallet_transactions (integer, idempotent, append-only) --
CREATE TABLE IF NOT EXISTS public.wallet_transactions_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES public.company_wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit','bounty_hold','bounty_release','bounty_refund','adjustment')),
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  available_after_minor BIGINT NOT NULL,
  reserved_after_minor BIGINT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  idempotency_key TEXT NOT NULL UNIQUE,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wtxn2_wallet ON public.wallet_transactions_v2(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wtxn2_ref ON public.wallet_transactions_v2(reference_type, reference_id);

-- 24.5 financial_ledger_entries — immutable balanced ledger ---
CREATE TABLE IF NOT EXISTS public.financial_ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL,
  account_key TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN
    ('company_available','company_reserved','platform_revenue','external')),
  entity_id UUID,
  entry_type public.ledger_entry_type NOT NULL CHECK (entry_type IN ('debit','credit')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'EGP' CHECK (currency = 'EGP'),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_txn ON public.financial_ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON public.financial_ledger_entries(account_key, created_at DESC);

-- Append-only guard: ledger rows can never be updated or deleted.
CREATE OR REPLACE FUNCTION public.prevent_finance_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (immutable financial record)', TG_TABLE_NAME;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_immutable ON public.financial_ledger_entries;
CREATE TRIGGER ledger_immutable
  BEFORE UPDATE OR DELETE ON public.financial_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.prevent_finance_mutation();

DROP TRIGGER IF EXISTS wtxn2_immutable ON public.wallet_transactions_v2;
CREATE TRIGGER wtxn2_immutable
  BEFORE UPDATE OR DELETE ON public.wallet_transactions_v2
  FOR EACH ROW EXECUTE FUNCTION public.prevent_finance_mutation();

-- 24.6 bounty_rewards — commission rate LOCKED at approval ----
CREATE TABLE IF NOT EXISTS public.bounty_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL UNIQUE REFERENCES public.reports(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  reward_amount_minor BIGINT NOT NULL CHECK (reward_amount_minor > 0),
  commission_rate_bp INT NOT NULL CHECK (commission_rate_bp BETWEEN 0 AND 10000),
  commission_amount_minor BIGINT NOT NULL CHECK (commission_amount_minor >= 0),
  total_charged_minor BIGINT NOT NULL CHECK (total_charged_minor > 0),
  currency TEXT NOT NULL DEFAULT 'EGP' CHECK (currency = 'EGP'),
  status public.reward_state NOT NULL DEFAULT 'reward_approved',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reward_company ON public.bounty_rewards(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_researcher ON public.bounty_rewards(researcher_id);
CREATE INDEX IF NOT EXISTS idx_reward_status ON public.bounty_rewards(status);

-- 24.7 researcher_payouts — payout execution log --------------
CREATE TABLE IF NOT EXISTS public.researcher_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reward_id UUID NOT NULL REFERENCES public.bounty_rewards(id) ON DELETE CASCADE,
  researcher_id UUID NOT NULL REFERENCES public.researcher_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'EGP' CHECK (currency = 'EGP'),
  status public.reward_state NOT NULL DEFAULT 'awaiting_payout',
  proof_url TEXT,
  payment_reference TEXT,
  failure_reason TEXT,
  processed_by UUID REFERENCES public.profiles(id),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rp_researcher ON public.researcher_payouts(researcher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rp_reward ON public.researcher_payouts(reward_id);
CREATE INDEX IF NOT EXISTS idx_rp_status ON public.researcher_payouts(status, created_at DESC);

-- 24.8 commission_settings + history (rate never hardcoded) ---
CREATE TABLE IF NOT EXISTS public.commission_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope public.commission_scope NOT NULL DEFAULT 'global',
  company_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  rate_bp INT NOT NULL CHECK (rate_bp BETWEEN 0 AND 10000),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- at most one active global row; at most one row per company scope
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_global
  ON public.commission_settings ((scope)) WHERE scope = 'global' AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_company
  ON public.commission_settings (company_id) WHERE scope = 'company';

CREATE TABLE IF NOT EXISTS public.commission_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_id UUID REFERENCES public.commission_settings(id) ON DELETE SET NULL,
  scope public.commission_scope NOT NULL,
  company_id UUID,
  old_rate_bp INT,
  new_rate_bp INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comm_hist ON public.commission_history(changed_at DESC);

-- 24.9 financial_approvals — admin decisions log --------------
CREATE TABLE IF NOT EXISTS public.financial_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN
    ('deposit_request','payout','adjustment','reward','commission')),
  entity_id UUID NOT NULL,
  approver_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL CHECK (action IN
    ('approved','rejected','processing','paid','failed','cancelled','retry')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fin_appr ON public.financial_approvals(entity_type, entity_id, created_at DESC);

-- 24.10 financial_audit_logs — dedicated finance audit trail --
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fin_audit_entity ON public.financial_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_audit_time ON public.financial_audit_logs(created_at DESC);

DROP TRIGGER IF EXISTS fin_audit_immutable ON public.financial_audit_logs;
CREATE TRIGGER fin_audit_immutable
  BEFORE UPDATE OR DELETE ON public.financial_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_finance_mutation();

DROP TRIGGER IF EXISTS wdr_touch ON public.wallet_deposit_requests;
CREATE TRIGGER wdr_touch BEFORE UPDATE ON public.wallet_deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS reward_touch ON public.bounty_rewards;
CREATE TRIGGER reward_touch BEFORE UPDATE ON public.bounty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS rp_touch ON public.researcher_payouts;
CREATE TRIGGER rp_touch BEFORE UPDATE ON public.researcher_payouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 24.11 RLS ---------------------------------------------------
ALTER TABLE public.wallet_deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.researcher_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- wallet_deposit_requests: company sees own; file request only as pending;
-- money is credited exclusively by the SECURITY DEFINER RPC.
DROP POLICY IF EXISTS "wdr_select" ON public.wallet_deposit_requests;
CREATE POLICY "wdr_select" ON public.wallet_deposit_requests FOR SELECT
  USING (public.has_role('admin') OR public.company_role(company_id, auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS "wdr_insert" ON public.wallet_deposit_requests;
CREATE POLICY "wdr_insert" ON public.wallet_deposit_requests FOR INSERT
  WITH CHECK (
    status = 'pending'
    AND public.has_company_permission(company_id, 'manage_payouts')
    AND currency = 'EGP'
  );

-- wallet_transactions_v2: read-only for admins and the owning company.
DROP POLICY IF EXISTS "wtxn2_select" ON public.wallet_transactions_v2;
CREATE POLICY "wtxn2_select" ON public.wallet_transactions_v2 FOR SELECT
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.company_wallets w
      WHERE w.id = wallet_id AND public.company_role(w.company_id, auth.uid()) IS NOT NULL
    )
  );

-- financial_ledger_entries: read-only; admins see all, companies see their own accounts.
DROP POLICY IF EXISTS "ledger_select" ON public.financial_ledger_entries;
CREATE POLICY "ledger_select" ON public.financial_ledger_entries FOR SELECT
  USING (
    public.has_role('admin')
    OR (
      account_type IN ('company_available','company_reserved')
      AND entity_id IS NOT NULL
      AND public.company_role(entity_id, auth.uid()) IS NOT NULL
    )
  );

-- bounty_rewards: researcher sees own, company sees own, admin sees all. No client writes.
DROP POLICY IF EXISTS "reward_select" ON public.bounty_rewards;
CREATE POLICY "reward_select" ON public.bounty_rewards FOR SELECT
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.researcher_profiles rp
      WHERE rp.id = researcher_id AND rp.user_id = auth.uid()
    )
    OR public.company_role(company_id, auth.uid()) IS NOT NULL
  );

-- researcher_payouts: same visibility triangle. No client writes.
DROP POLICY IF EXISTS "rp_select" ON public.researcher_payouts;
CREATE POLICY "rp_select" ON public.researcher_payouts FOR SELECT
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.researcher_profiles rp
      WHERE rp.id = researcher_id AND rp.user_id = auth.uid()
    )
    OR public.company_role(company_id, auth.uid()) IS NOT NULL
  );

-- commission_settings: admins manage; company members may read global + own override.
DROP POLICY IF EXISTS "cs_select" ON public.commission_settings;
CREATE POLICY "cs_select" ON public.commission_settings FOR SELECT
  USING (
    public.has_role('admin')
    OR scope = 'global'
    OR (scope = 'company' AND public.company_role(company_id, auth.uid()) IS NOT NULL)
  );

-- commission_history / financial_approvals / financial_audit_logs: admin read-only.
DROP POLICY IF EXISTS "ch_select" ON public.commission_history;
CREATE POLICY "ch_select" ON public.commission_history FOR SELECT USING (public.has_role('admin'));
DROP POLICY IF EXISTS "fa_select" ON public.financial_approvals;
CREATE POLICY "fa_select" ON public.financial_approvals FOR SELECT USING (public.has_role('admin'));
DROP POLICY IF EXISTS "fau_select" ON public.financial_audit_logs;
CREATE POLICY "fau_select" ON public.financial_audit_logs FOR SELECT USING (public.has_role('admin'));

-- 24.12 Commission resolution --------------------------------
-- Effective rate: active company-specific override wins over the active
-- global rate. NOTHING is hardcoded — missing configuration raises.
CREATE OR REPLACE FUNCTION public.get_effective_commission_rate(p_company UUID)
RETURNS INT AS $$
DECLARE v_rate INT;
BEGIN
  SELECT rate_bp INTO v_rate
    FROM public.commission_settings
   WHERE scope = 'company' AND company_id = p_company AND is_active
   ORDER BY updated_at DESC LIMIT 1;
  IF v_rate IS NULL THEN
    SELECT rate_bp INTO v_rate
      FROM public.commission_settings
     WHERE scope = 'global' AND is_active
     ORDER BY updated_at DESC LIMIT 1;
  END IF;
  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'no commission configured';
  END IF;
  RETURN v_rate;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 24.13 Admin sets the commission rate (global or per-company) -
CREATE OR REPLACE FUNCTION public.set_commission_rate(
  p_scope TEXT, p_company UUID, p_rate_bp INT, p_reason TEXT
) RETURNS UUID AS $$
DECLARE v_uid UUID; v_old INT; v_id UUID; v_scope public.commission_scope;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_scope NOT IN ('global','company') THEN RAISE EXCEPTION 'invalid scope'; END IF;
  IF p_scope = 'company' AND p_company IS NULL THEN RAISE EXCEPTION 'company required'; END IF;
  IF p_rate_bp IS NULL OR p_rate_bp < 0 OR p_rate_bp > 10000 THEN RAISE EXCEPTION 'invalid rate'; END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'reason required'; END IF;
  v_scope := p_scope::public.commission_scope;

  IF p_scope = 'global' THEN
    SELECT rate_bp INTO v_old FROM public.commission_settings WHERE scope='global' AND is_active ORDER BY updated_at DESC LIMIT 1;
    UPDATE public.commission_settings SET is_active = false, updated_at = now() WHERE scope='global' AND is_active;
    INSERT INTO public.commission_settings(scope, company_id, rate_bp, is_active, created_by)
    VALUES ('global', NULL, p_rate_bp, true, v_uid) RETURNING id INTO v_id;
  ELSE
    SELECT rate_bp INTO v_old FROM public.commission_settings WHERE scope='company' AND company_id=p_company AND is_active LIMIT 1;
    UPDATE public.commission_settings SET is_active = false, updated_at = now() WHERE scope='company' AND company_id=p_company AND is_active;
    -- enforce the one-row-per-company rule
    DELETE FROM public.commission_settings WHERE scope='company' AND company_id=p_company;
    INSERT INTO public.commission_settings(scope, company_id, rate_bp, is_active, created_by)
    VALUES ('company', p_company, p_rate_bp, true, v_uid) RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.commission_history(setting_id, scope, company_id, old_rate_bp, new_rate_bp, is_active, reason, changed_by)
  VALUES (v_id, v_scope, p_company, v_old, p_rate_bp, true, trim(p_reason), v_uid);

  INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'commission.updated', 'commission_settings', v_id,
    jsonb_build_object('scope', p_scope, 'company_id', p_company, 'old_rate_bp', v_old, 'new_rate_bp', p_rate_bp, 'reason', trim(p_reason)));
  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Enable/disable a company-specific override (keeps the stored rate).
CREATE OR REPLACE FUNCTION public.toggle_company_commission(p_company UUID, p_activate BOOLEAN)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_row public.commission_settings%ROWTYPE; v_new_active BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.commission_settings WHERE scope='company' AND company_id=p_company ORDER BY updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  v_new_active := COALESCE(p_activate, NOT v_row.is_active);
  UPDATE public.commission_settings SET is_active = v_new_active, updated_at = now() WHERE id = v_row.id;
  INSERT INTO public.commission_history(setting_id, scope, company_id, old_rate_bp, new_rate_bp, is_active, reason, changed_by)
  VALUES (v_row.id, 'company', p_company, v_row.rate_bp, v_row.rate_bp, v_new_active,
    CASE WHEN v_new_active THEN 'تفعيل نسبة خاصة بالشركة' ELSE 'إيقاف النسبة الخاصة (الرجوع للنسبة العامة)' END, v_uid);
  INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'commission.toggled', 'commission_settings', v_row.id,
    jsonb_build_object('company_id', p_company, 'is_active', v_new_active));
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 24.14 Deposit review v2 (approve credits ONCE) --------------
CREATE OR REPLACE FUNCTION public.review_deposit_request_v2(
  p_request UUID, p_approve BOOLEAN, p_note TEXT, p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_uid UUID; v_req public.wallet_deposit_requests%ROWTYPE;
  v_wallet UUID; v_avail BIGINT; v_txn UUID; v_amount BIGINT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_req FROM public.wallet_deposit_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'already decided'; END IF;
  v_amount := v_req.amount_minor;

  IF NOT COALESCE(p_approve, false) THEN
    UPDATE public.wallet_deposit_requests
      SET status='rejected', reviewed_by=v_uid, review_note=p_note, reviewed_at=now(), updated_at=now()
     WHERE id = p_request;
    INSERT INTO public.financial_approvals(entity_type, entity_id, approver_id, action, note)
    VALUES ('deposit_request', p_request, v_uid, 'rejected', p_note);
    INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
    VALUES (v_uid, 'deposit.rejected', 'wallet_deposit_requests', p_request,
      jsonb_build_object('company_id', v_req.company_id, 'amount_minor', v_amount, 'note', p_note));
    RETURN NULL;
  END IF;

  -- Idempotency: replaying the same approval must not double-credit.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_txn FROM public.wallet_transactions_v2 WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_txn IS NOT NULL THEN RETURN v_txn; END IF;
  END IF;

  INSERT INTO public.company_wallets(company_id) VALUES (v_req.company_id) ON CONFLICT (company_id) DO NOTHING;
  SELECT id, available_balance_minor INTO v_wallet, v_avail
    FROM public.company_wallets WHERE company_id = v_req.company_id FOR UPDATE;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'company wallet missing'; END IF;

  v_txn := uuid_generate_v4();
  UPDATE public.company_wallets
     SET available_balance_minor = available_balance_minor + v_amount,
         total_deposits_minor = total_deposits_minor + v_amount,
         updated_at = now()
   WHERE id = v_wallet;

  INSERT INTO public.wallet_transactions_v2(id, wallet_id, type, direction, amount_minor,
      available_after_minor, reserved_after_minor, reference_type, reference_id, idempotency_key, note, created_by)
  VALUES (v_txn, v_wallet, 'deposit', 'in', v_amount, v_avail + v_amount, 0,
      'wallet_deposit_requests', p_request,
      COALESCE(p_idempotency_key, 'deposit:' || p_request::text || ':' || v_txn::text),
      'اعتماد إيداع بعد التحقق من التحويل', v_uid);

  -- Balanced ledger: company_available(debit) = external:funding(credit)
  INSERT INTO public.financial_ledger_entries(transaction_id, account_key, account_type, entity_id, entry_type, amount_minor, description)
  VALUES (v_txn, 'company_available:' || v_req.company_id::text, 'company_available', v_req.company_id, 'debit', v_amount, 'إيداع معتمد'),
         (v_txn, 'external:funding', 'external', NULL, 'credit', v_amount, 'تمويل خارجي — إيداع شركة');

  UPDATE public.wallet_deposit_requests
     SET status='approved', reviewed_by=v_uid, review_note=p_note, reviewed_at=now(),
         transaction_id=v_txn, updated_at=now()
   WHERE id = p_request;

  INSERT INTO public.financial_approvals(entity_type, entity_id, approver_id, action, note)
  VALUES ('deposit_request', p_request, v_uid, 'approved', p_note);
  INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'deposit.approved', 'wallet_deposit_requests', p_request,
    jsonb_build_object('company_id', v_req.company_id, 'amount_minor', v_amount, 'txn', v_txn));
  RETURN v_txn;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 24.15 Reward approval: reserve (reward + commission) ONCE ---
CREATE OR REPLACE FUNCTION public.approve_bounty_reward(
  p_report UUID, p_reward_amount_minor BIGINT, p_confirm BOOLEAN, p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_uid UUID; v_program UUID; v_company UUID; v_researcher UUID; v_status TEXT;
  v_rate INT; v_commission BIGINT; v_total BIGINT; v_reward UUID; v_txn UUID;
  v_wallet UUID; v_avail BIGINT; v_reserved BIGINT; v_report_no TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_confirm IS NOT TRUE THEN RAISE EXCEPTION 'confirmation required'; END IF;
  IF p_reward_amount_minor IS NULL OR p_reward_amount_minor <= 0 OR p_reward_amount_minor > 1000000000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  SELECT program_id, researcher_id, status INTO v_program, v_researcher, v_status
    FROM public.reports WHERE id = p_report;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v_status <> 'accepted' THEN RAISE EXCEPTION 'report not accepted'; END IF;

  SELECT company_id INTO v_company FROM public.programs WHERE id = v_program;
  IF v_company IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (
    public.has_company_permission(v_company, 'manage_payouts')
    OR public.has_role('admin')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Idempotency by explicit key…
  IF p_idempotency_key IS NOT NULL THEN
    SELECT reference_id INTO v_reward FROM public.wallet_transactions_v2
      WHERE idempotency_key = p_idempotency_key AND reference_type='bounty_rewards' LIMIT 1;
    IF v_reward IS NOT NULL THEN RETURN v_reward; END IF;
  END IF;
  -- …and by the one-reward-per-report invariant.
  SELECT id INTO v_reward FROM public.bounty_rewards WHERE report_id = p_report;
  IF v_reward IS NOT NULL THEN RETURN v_reward; END IF;

  v_rate := public.get_effective_commission_rate(v_company);
  -- integer math only: reward <= 1e9 piastres keeps product < 2^63
  v_commission := (p_reward_amount_minor * v_rate) / 10000;
  v_total := p_reward_amount_minor + v_commission;

  INSERT INTO public.company_wallets(company_id) VALUES (v_company) ON CONFLICT (company_id) DO NOTHING;
  SELECT id, available_balance_minor, reserved_balance_minor INTO v_wallet, v_avail, v_reserved
    FROM public.company_wallets WHERE company_id = v_company FOR UPDATE;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'company wallet missing'; END IF;
  IF v_avail < v_total THEN RAISE EXCEPTION 'insufficient funds'; END IF;

  v_reward := uuid_generate_v4();
  v_txn := uuid_generate_v4();

  UPDATE public.company_wallets
     SET available_balance_minor = available_balance_minor - v_total,
         reserved_balance_minor = reserved_balance_minor + v_total,
         updated_at = now()
   WHERE id = v_wallet;

  INSERT INTO public.wallet_transactions_v2(id, wallet_id, type, direction, amount_minor,
      available_after_minor, reserved_after_minor, reference_type, reference_id, idempotency_key, note, created_by)
  VALUES (v_txn, v_wallet, 'bounty_hold', 'out', v_total, v_avail - v_total, v_reserved + v_total,
      'bounty_rewards', v_reward,
      COALESCE(p_idempotency_key, 'reward:' || p_report::text || ':' || v_txn::text),
      'حجز مبلغ المكافأة + العمولة عند اعتماد المكافأة', v_uid);

  INSERT INTO public.bounty_rewards(id, report_id, program_id, company_id, researcher_id,
      reward_amount_minor, commission_rate_bp, commission_amount_minor, total_charged_minor, status, approved_by)
  VALUES (v_reward, p_report, v_program, v_company, v_researcher,
      p_reward_amount_minor, v_rate, v_commission, v_total, 'reward_approved', v_uid);

  INSERT INTO public.researcher_payouts(reward_id, researcher_id, company_id, amount_minor, status)
  VALUES (v_reward, v_researcher, v_company, p_reward_amount_minor, 'awaiting_payout');

  -- Balanced ledger: reserved(debit) = available(credit)
  INSERT INTO public.financial_ledger_entries(transaction_id, account_key, account_type, entity_id, entry_type, amount_minor, description)
  VALUES (v_txn, 'company_reserved:' || v_company::text, 'company_reserved', v_company, 'debit', v_total, 'حجز مكافأة تقرير'),
         (v_txn, 'company_available:' || v_company::text, 'company_available', v_company, 'credit', v_total, 'تحويل من المتاح إلى المحجوز');

  -- Legacy researcher wallet mirror (NUMERIC(12,2) — exact, display only)
  INSERT INTO public.wallets(researcher_id, pending_balance, total_earned)
  VALUES (v_researcher, p_reward_amount_minor::NUMERIC / 100, p_reward_amount_minor::NUMERIC / 100)
  ON CONFLICT (researcher_id) DO UPDATE
    SET pending_balance = public.wallets.pending_balance + EXCLUDED.pending_balance,
        total_earned = public.wallets.total_earned + EXCLUDED.total_earned,
        updated_at = now();

  SELECT report_number INTO v_report_no FROM public.reports WHERE id = p_report;
  UPDATE public.reports SET status = 'reward_approved', updated_at = now()
   WHERE id = p_report AND status = 'accepted';

  INSERT INTO public.financial_approvals(entity_type, entity_id, approver_id, action, note)
  VALUES ('reward', v_reward, v_uid, 'approved', 'اعتماد مكافأة التقرير ' || COALESCE(v_report_no, ''));
  INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'reward.approved', 'bounty_rewards', v_reward,
    jsonb_build_object('report_id', p_report, 'company_id', v_company, 'researcher_id', v_researcher,
      'reward_minor', p_reward_amount_minor, 'rate_bp', v_rate, 'commission_minor', v_commission, 'total_minor', v_total));
  RETURN v_reward;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 24.16 Payout lifecycle --------------------------------------
CREATE OR REPLACE FUNCTION public.start_reward_payout(p_payout UUID)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_reward UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT reward_id INTO v_reward FROM public.researcher_payouts
   WHERE id = p_payout AND status = 'awaiting_payout' FOR UPDATE;
  IF v_reward IS NULL THEN RAISE EXCEPTION 'invalid state'; END IF;
  UPDATE public.researcher_payouts SET status='processing', processed_by=v_uid, updated_at=now() WHERE id = p_payout;
  UPDATE public.bounty_rewards SET status='processing', updated_at=now() WHERE id = v_reward;
  INSERT INTO public.financial_approvals(entity_type, entity_id, approver_id, action)
  VALUES ('payout', p_payout, v_uid, 'processing');
  INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'payout.processing', 'researcher_payouts', p_payout, jsonb_build_object('reward_id', v_reward));
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.complete_reward_payout(
  p_payout UUID, p_proof_url TEXT, p_reference TEXT, p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_uid UUID; v_payout public.researcher_payouts%ROWTYPE; v_reward public.bounty_rewards%ROWTYPE;
  v_wallet UUID; v_avail BIGINT; v_reserved BIGINT; v_txn UUID; v_researcher UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_txn FROM public.wallet_transactions_v2 WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_txn IS NOT NULL THEN RETURN v_txn; END IF;
  END IF;

  SELECT * INTO v_payout FROM public.researcher_payouts WHERE id = p_payout FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  -- NEVER from failed/cancelled/paid — only live payouts can complete.
  IF v_payout.status NOT IN ('awaiting_payout','processing') THEN RAISE EXCEPTION 'invalid state'; END IF;

  SELECT * INTO v_reward FROM public.bounty_rewards WHERE id = v_payout.reward_id FOR UPDATE;
  IF v_reward.status NOT IN ('reward_approved','awaiting_payout','processing') THEN RAISE EXCEPTION 'invalid state'; END IF;
  v_researcher := v_reward.researcher_id;

  INSERT INTO public.company_wallets(company_id) VALUES (v_reward.company_id) ON CONFLICT (company_id) DO NOTHING;
  SELECT id, available_balance_minor, reserved_balance_minor INTO v_wallet, v_avail, v_reserved
    FROM public.company_wallets WHERE company_id = v_reward.company_id FOR UPDATE;
  IF v_reserved < v_reward.total_charged_minor THEN RAISE EXCEPTION 'insufficient reserved'; END IF;

  v_txn := uuid_generate_v4();
  UPDATE public.company_wallets
     SET reserved_balance_minor = reserved_balance_minor - v_reward.total_charged_minor,
         total_rewards_minor = total_rewards_minor + v_reward.reward_amount_minor,
         total_fees_minor = total_fees_minor + v_reward.commission_amount_minor,
         updated_at = now()
   WHERE id = v_wallet;

  INSERT INTO public.wallet_transactions_v2(id, wallet_id, type, direction, amount_minor,
      available_after_minor, reserved_after_minor, reference_type, reference_id, idempotency_key, note, created_by)
  VALUES (v_txn, v_wallet, 'bounty_release', 'out', v_reward.reward_amount_minor, v_avail,
      v_reserved - v_reward.total_charged_minor, 'researcher_payouts', p_payout,
      COALESCE(p_idempotency_key, 'payout:' || p_payout::text || ':' || v_txn::text),
      'صرف المكافأة للباحث — العمولة دخل منصة', v_uid);

  -- Balanced ledger: reserved(debit T) = platform_revenue(credit C) + external:payouts(credit R)
  INSERT INTO public.financial_ledger_entries(transaction_id, account_key, account_type, entity_id, entry_type, amount_minor, description)
  VALUES (v_txn, 'company_reserved:' || v_reward.company_id::text, 'company_reserved', v_reward.company_id, 'debit', v_reward.total_charged_minor, 'صرف المكافأة'),
         (v_txn, 'platform_revenue', 'platform_revenue', NULL, 'credit', v_reward.commission_amount_minor, 'عمولة المنصة'),
         (v_txn, 'external:payouts', 'external', NULL, 'credit', v_reward.reward_amount_minor, 'دفعة خارجية للباحث');

  UPDATE public.researcher_payouts
     SET status='paid', proof_url=p_proof_url, payment_reference=p_reference,
         processed_by=v_uid, paid_at=now(), updated_at=now()
   WHERE id = p_payout AND status IN ('awaiting_payout','processing');
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid state'; END IF;

  UPDATE public.bounty_rewards SET status='paid', paid_at=now(), updated_at=now() WHERE id = v_reward.id;
  UPDATE public.reports SET status='paid', updated_at=now()
   WHERE id = v_reward.report_id AND status IN ('reward_approved','processing');

  -- Legacy researcher wallet mirror: pending -> withdrawable balance
  UPDATE public.wallets
     SET pending_balance = pending_balance - (v_reward.reward_amount_minor::NUMERIC / 100),
         balance = balance + (v_reward.reward_amount_minor::NUMERIC / 100),
         updated_at = now()
   WHERE researcher_id = v_researcher;

  INSERT INTO public.financial_approvals(entity_type, entity_id, approver_id, action, note)
  VALUES ('payout', p_payout, v_uid, 'paid', p_reference);
  INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'payout.completed', 'researcher_payouts', p_payout,
    jsonb_build_object('reward_id', v_reward.id, 'researcher_id', v_researcher,
      'reward_minor', v_reward.reward_amount_minor, 'commission_minor', v_reward.commission_amount_minor,
      'proof_url', p_proof_url, 'reference', p_reference, 'txn', v_txn));
  RETURN v_txn;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Failure/cancellation ALWAYS refunds the reservation to available.
CREATE OR REPLACE FUNCTION public.fail_reward_payout(p_payout UUID, p_reason TEXT, p_cancel BOOLEAN DEFAULT false)
RETURNS VOID AS $$
DECLARE v_uid UUID; v_payout public.researcher_payouts%ROWTYPE; v_reward public.bounty_rewards%ROWTYPE;
  v_wallet UUID; v_avail BIGINT; v_reserved BIGINT; v_txn UUID; v_state public.reward_state;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'reason required'; END IF;
  v_state := CASE WHEN COALESCE(p_cancel, false) THEN 'cancelled' ELSE 'failed' END;

  SELECT * INTO v_payout FROM public.researcher_payouts WHERE id = p_payout FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v_payout.status NOT IN ('awaiting_payout','processing') THEN RAISE EXCEPTION 'invalid state'; END IF;

  SELECT * INTO v_reward FROM public.bounty_rewards WHERE id = v_payout.reward_id FOR UPDATE;
  IF v_reward.status NOT IN ('reward_approved','awaiting_payout','processing') THEN RAISE EXCEPTION 'invalid state'; END IF;

  SELECT id, available_balance_minor, reserved_balance_minor INTO v_wallet, v_avail, v_reserved
    FROM public.company_wallets WHERE company_id = v_reward.company_id FOR UPDATE;
  IF v_reserved < v_reward.total_charged_minor THEN RAISE EXCEPTION 'insufficient reserved'; END IF;

  v_txn := uuid_generate_v4();
  UPDATE public.company_wallets
     SET reserved_balance_minor = reserved_balance_minor - v_reward.total_charged_minor,
         available_balance_minor = available_balance_minor + v_reward.total_charged_minor,
         updated_at = now()
   WHERE id = v_wallet;

  INSERT INTO public.wallet_transactions_v2(id, wallet_id, type, direction, amount_minor,
      available_after_minor, reserved_after_minor, reference_type, reference_id, idempotency_key, note, created_by)
  VALUES (v_txn, v_wallet, 'bounty_refund', 'in', v_reward.total_charged_minor, v_avail + v_reward.total_charged_minor,
      v_reserved - v_reward.total_charged_minor, 'researcher_payouts', p_payout,
      'refund:' || p_payout::text || ':' || v_txn::text,
      CASE WHEN v_state='failed' THEN 'فشل الصرف — إرجاع المبلغ المحجوز' ELSE 'إلغاء الصرف — إرجاع المبلغ المحجوز' END, v_uid);

  INSERT INTO public.financial_ledger_entries(transaction_id, account_key, account_type, entity_id, entry_type, amount_minor, description)
  VALUES (v_txn, 'company_available:' || v_reward.company_id::text, 'company_available', v_reward.company_id, 'debit', v_reward.total_charged_minor, 'إرجاع الحجز'),
         (v_txn, 'company_reserved:' || v_reward.company_id::text, 'company_reserved', v_reward.company_id, 'credit', v_reward.total_charged_minor, 'فك حجز المكافأة');

  UPDATE public.researcher_payouts
     SET status=v_state, failure_reason=trim(p_reason), processed_by=v_uid, updated_at=now()
   WHERE id = p_payout AND status IN ('awaiting_payout','processing');
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid state'; END IF;

  -- Reward returns to 'reward_approved' (still unpaid); retry re-reserves at the LOCKED rate.
  UPDATE public.bounty_rewards SET status='reward_approved', updated_at=now() WHERE id = v_reward.id;
  UPDATE public.wallets
     SET pending_balance = GREATEST(0, pending_balance - (v_reward.reward_amount_minor::NUMERIC / 100)),
         total_earned = GREATEST(0, total_earned - (v_reward.reward_amount_minor::NUMERIC / 100)),
         updated_at = now()
   WHERE researcher_id = v_reward.researcher_id;

  INSERT INTO public.financial_approvals(entity_type, entity_id, approver_id, action, note)
  VALUES ('payout', p_payout, v_uid, v_state::text, trim(p_reason));
  INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'payout.' || v_state::text, 'researcher_payouts', p_payout,
    jsonb_build_object('reward_id', v_reward.id, 'reason', trim(p_reason), 'refunded_minor', v_reward.total_charged_minor));
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Retry: re-reserve at the rate LOCKED in the reward row (no re-pricing).
CREATE OR REPLACE FUNCTION public.retry_reward_payout(p_reward UUID)
RETURNS UUID AS $$
DECLARE v_uid UUID; v_reward public.bounty_rewards%ROWTYPE;
  v_wallet UUID; v_avail BIGINT; v_reserved BIGINT; v_txn UUID; v_payout UUID; v_live UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_reward FROM public.bounty_rewards WHERE id = p_reward;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (
    public.has_company_permission(v_reward.company_id, 'manage_payouts')
    OR public.has_role('admin')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_reward.status <> 'reward_approved' THEN RAISE EXCEPTION 'invalid state'; END IF;
  SELECT id INTO v_live FROM public.researcher_payouts
   WHERE reward_id = p_reward AND status IN ('awaiting_payout','processing') LIMIT 1;
  IF v_live IS NOT NULL THEN RAISE EXCEPTION 'invalid state'; END IF;

  SELECT id, available_balance_minor, reserved_balance_minor INTO v_wallet, v_avail, v_reserved
    FROM public.company_wallets WHERE company_id = v_reward.company_id FOR UPDATE;
  IF v_avail < v_reward.total_charged_minor THEN RAISE EXCEPTION 'insufficient funds'; END IF;

  v_txn := uuid_generate_v4();
  UPDATE public.company_wallets
     SET available_balance_minor = available_balance_minor - v_reward.total_charged_minor,
         reserved_balance_minor = reserved_balance_minor + v_reward.total_charged_minor,
         updated_at = now()
   WHERE id = v_wallet;

  INSERT INTO public.wallet_transactions_v2(id, wallet_id, type, direction, amount_minor,
      available_after_minor, reserved_after_minor, reference_type, reference_id, idempotency_key, note, created_by)
  VALUES (v_txn, v_wallet, 'bounty_hold', 'out', v_reward.total_charged_minor, v_avail - v_reward.total_charged_minor,
      v_reserved + v_reward.total_charged_minor, 'bounty_rewards', p_reward,
      'reward-retry:' || p_reward::text || ':' || v_txn::text, 'إعادة حجز مكافأة بعد فشل الصرف', v_uid);

  INSERT INTO public.financial_ledger_entries(transaction_id, account_key, account_type, entity_id, entry_type, amount_minor, description)
  VALUES (v_txn, 'company_reserved:' || v_reward.company_id::text, 'company_reserved', v_reward.company_id, 'debit', v_reward.total_charged_minor, 'إعادة حجز مكافأة'),
         (v_txn, 'company_available:' || v_reward.company_id::text, 'company_available', v_reward.company_id, 'credit', v_reward.total_charged_minor, 'تحويل من المتاح إلى المحجوز');

  INSERT INTO public.researcher_payouts(reward_id, researcher_id, company_id, amount_minor, status)
  VALUES (p_reward, v_reward.researcher_id, v_reward.company_id, v_reward.reward_amount_minor, 'awaiting_payout')
  RETURNING id INTO v_payout;

  INSERT INTO public.wallets(researcher_id, pending_balance, total_earned)
  VALUES (v_reward.researcher_id, v_reward.reward_amount_minor::NUMERIC / 100, v_reward.reward_amount_minor::NUMERIC / 100)
  ON CONFLICT (researcher_id) DO UPDATE
    SET pending_balance = public.wallets.pending_balance + EXCLUDED.pending_balance,
        total_earned = public.wallets.total_earned + EXCLUDED.total_earned,
        updated_at = now();

  INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'reward.retried', 'bounty_rewards', p_reward,
    jsonb_build_object('payout_id', v_payout, 'total_minor', v_reward.total_charged_minor));
  RETURN v_payout;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 24.17 Admin manual adjustment (ledger-based, audited) -------
CREATE OR REPLACE FUNCTION public.adjust_company_wallet_v2(
  p_company UUID, p_amount_minor BIGINT, p_note TEXT, p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_uid UUID; v_wallet UUID; v_avail BIGINT; v_txn UUID; v_abs BIGINT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_amount_minor IS NULL OR p_amount_minor = 0 OR abs(p_amount_minor) > 10000000000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF p_note IS NULL OR char_length(trim(p_note)) < 3 THEN RAISE EXCEPTION 'note required'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_txn FROM public.wallet_transactions_v2 WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_txn IS NOT NULL THEN RETURN v_txn; END IF;
  END IF;

  INSERT INTO public.company_wallets(company_id) VALUES (p_company) ON CONFLICT (company_id) DO NOTHING;
  SELECT id, available_balance_minor INTO v_wallet, v_avail
    FROM public.company_wallets WHERE company_id = p_company FOR UPDATE;
  v_abs := abs(p_amount_minor);
  IF p_amount_minor < 0 AND v_avail < v_abs THEN RAISE EXCEPTION 'insufficient funds'; END IF;

  v_txn := uuid_generate_v4();
  UPDATE public.company_wallets
     SET available_balance_minor = available_balance_minor + p_amount_minor, updated_at = now()
   WHERE id = v_wallet;

  INSERT INTO public.wallet_transactions_v2(id, wallet_id, type, direction, amount_minor,
      available_after_minor, reserved_after_minor, reference_type, idempotency_key, note, created_by)
  VALUES (v_txn, v_wallet, 'adjustment', CASE WHEN p_amount_minor > 0 THEN 'in' ELSE 'out' END, v_abs,
      v_avail + p_amount_minor, 0, 'financial_adjustments',
      COALESCE(p_idempotency_key, 'adjust:' || p_company::text || ':' || v_txn::text), trim(p_note), v_uid);

  INSERT INTO public.financial_ledger_entries(transaction_id, account_key, account_type, entity_id, entry_type, amount_minor, description)
  SELECT v_txn,
    CASE WHEN p_amount_minor > 0 THEN 'company_available:' || p_company::text ELSE 'external:adjustment' END,
    CASE WHEN p_amount_minor > 0 THEN 'company_available' ELSE 'external' END,
    CASE WHEN p_amount_minor > 0 THEN p_company ELSE NULL END,
    CASE WHEN p_amount_minor > 0 THEN 'debit' ELSE 'credit' END, v_abs, trim(p_note)
  UNION ALL
  SELECT v_txn,
    CASE WHEN p_amount_minor > 0 THEN 'external:adjustment' ELSE 'company_available:' || p_company::text END,
    CASE WHEN p_amount_minor > 0 THEN 'external' ELSE 'company_available' END,
    CASE WHEN p_amount_minor > 0 THEN NULL ELSE p_company END,
    CASE WHEN p_amount_minor > 0 THEN 'credit' ELSE 'debit' END, v_abs, trim(p_note);

  INSERT INTO public.financial_approvals(entity_type, entity_id, approver_id, action, note)
  VALUES ('adjustment', v_txn, v_uid, CASE WHEN p_amount_minor > 0 THEN 'approved' ELSE 'processing' END, trim(p_note));
  INSERT INTO public.financial_audit_logs(actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'wallet.adjusted', 'company_wallets', v_wallet,
    jsonb_build_object('company_id', p_company, 'amount_minor', p_amount_minor, 'note', trim(p_note)));
  RETURN v_txn;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 24.18 Seed the global commission (20% = 2000 bp) ONCE -------
-- Configuration data, not code: admins change it via set_commission_rate.
INSERT INTO public.commission_settings(scope, company_id, rate_bp, is_active)
SELECT 'global', NULL, 2000, true
WHERE NOT EXISTS (SELECT 1 FROM public.commission_settings WHERE scope = 'global');

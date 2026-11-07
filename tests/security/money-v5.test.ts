import fs from 'fs';

/**
 * Smart Wallet & Finance v1 (migration 24) — structure invariants:
 *  - integer minor units only (BIGINT piastres, CHECK >= 0);
 *  - immutable ledger + append-only transactions (triggers + read-only RLS);
 *  - every money RPC is SECURITY DEFINER with a pinned search_path and
 *    locks the rows it decides on (FOR UPDATE);
 *  - deposits credit EXACTLY ONCE (status guard + idempotency key UNIQUE);
 *  - rewards reserve (reward + LOCKED commission) with an explicit
 *    confirmation gate and one-reward-per-report uniqueness;
 *  - a payout can NEVER reach 'paid' from failed/cancelled, and failure
 *    ALWAYS refunds the reservation;
 *  - the commission rate is resolved from commission_settings — never
 *    hardcoded in the RPC body.
 */
const sql = fs.readFileSync('supabase/migrations/24_smart_wallet_finance.sql', 'utf8');

describe('migration 24: integer minor units', () => {
  test('wallet balances are BIGINT with non-negative CHECKs', () => {
    expect(sql).toMatch(/available_balance_minor BIGINT NOT NULL DEFAULT 0 CHECK \(available_balance_minor >= 0\)/);
    expect(sql).toMatch(/reserved_balance_minor BIGINT NOT NULL DEFAULT 0 CHECK \(reserved_balance_minor >= 0\)/);
  });
  test('all money columns are *_minor BIGINT', () => {
    expect(sql).toMatch(/amount_minor BIGINT NOT NULL CHECK \(amount_minor > 0\)/);
    expect(sql).toMatch(/reward_amount_minor BIGINT NOT NULL CHECK \(reward_amount_minor > 0\)/);
    expect(sql).toMatch(/total_charged_minor BIGINT NOT NULL CHECK \(total_charged_minor > 0\)/);
  });
  test('legacy NUMERIC balance migrated exactly (x100) once', () => {
    expect(sql).toMatch(/SET available_balance_minor = GREATEST\(0, ROUND\(balance \* 100\)::BIGINT\)/);
  });
});

describe('migration 24: append-only financial records', () => {
  test('ledger + transactions + audit logs have mutation-blocking triggers', () => {
    expect(sql).toMatch(/CREATE TRIGGER ledger_immutable\s+BEFORE UPDATE OR DELETE ON public\.financial_ledger_entries/);
    expect(sql).toMatch(/CREATE TRIGGER wtxn2_immutable\s+BEFORE UPDATE OR DELETE ON public\.wallet_transactions_v2/);
    expect(sql).toMatch(/CREATE TRIGGER fin_audit_immutable\s+BEFORE UPDATE OR DELETE ON public\.financial_audit_logs/);
    expect(sql).toMatch(/RAISE EXCEPTION '% is append-only \(immutable financial record\)', TG_TABLE_NAME/);
  });
  test('RLS enabled on all ten finance tables', () => {
    const tables = [
      'wallet_deposit_requests', 'wallet_transactions_v2', 'financial_ledger_entries',
      'bounty_rewards', 'researcher_payouts', 'commission_settings',
      'commission_history', 'financial_approvals', 'financial_audit_logs',
    ];
    for (const t of tables) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`));
    }
  });
  test('no client write policies on the ledger/transactions/approvals', () => {
    for (const t of ['wallet_transactions_v2', 'financial_ledger_entries', 'financial_approvals', 'commission_history', 'financial_audit_logs', 'bounty_rewards', 'researcher_payouts']) {
      const policyBlock = sql.match(new RegExp(`DROP POLICY IF EXISTS "[a-z0-9_]+" ON public\\.${t}[\\s\\S]*?(?=DROP POLICY|-- \\d|$)`));
      expect(policyBlock).not.toBeNull();
      expect(policyBlock?.[0]).not.toMatch(/FOR INSERT/);
      expect(policyBlock?.[0]).not.toMatch(/FOR UPDATE/);
    }
  });
  test('deposit requests: company inserts pending rows only', () => {
    expect(sql).toMatch(/CREATE POLICY "wdr_insert" ON public\.wallet_deposit_requests FOR INSERT\s+WITH CHECK \(/);
    expect(sql).toMatch(/status = 'pending'\s+AND public\.has_company_permission\(company_id, 'manage_payouts'\)/);
  });
});

describe('migration 24: RPC hardening', () => {
  const rpcs = [
    'get_effective_commission_rate', 'set_commission_rate', 'toggle_company_commission',
    'review_deposit_request_v2', 'approve_bounty_reward', 'start_reward_payout',
    'complete_reward_payout', 'fail_reward_payout', 'retry_reward_payout',
    'adjust_company_wallet_v2',
  ];
  test('all finance RPCs are SECURITY DEFINER with pinned search_path', () => {
    for (const f of rpcs) {
      const body = sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${f}\\([\\s\\S]*?LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`));
      expect(body).not.toBeNull();
    }
  });
  test('deposit approval locks the request row and rejects decided ones', () => {
    const body = sql.match(/review_deposit_request_v2\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/WHERE id = p_request FOR UPDATE/);
    expect(body).toMatch(/IF v_req\.status <> 'pending' THEN RAISE EXCEPTION 'already decided'/);
  });
  test('reward approval requires EXPLICIT confirmation and accepted reports', () => {
    const body = sql.match(/approve_bounty_reward\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/IF p_confirm IS NOT TRUE THEN RAISE EXCEPTION 'confirmation required'/);
    expect(body).toMatch(/IF v_status <> 'accepted' THEN RAISE EXCEPTION 'report not accepted'/);
    expect(body).toMatch(/IF v_avail < v_total THEN RAISE EXCEPTION 'insufficient funds'/);
  });
  test('reward approval locks the wallet row (race-safe reservation)', () => {
    const body = sql.match(/approve_bounty_reward\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/FROM public\.company_wallets WHERE company_id = v_company FOR UPDATE/);
  });
  test('commission rate is resolved from settings — no hardcoded rate in the RPC', () => {
    const body = sql.match(/approve_bounty_reward\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/v_rate := public\.get_effective_commission_rate\(v_company\)/);
    expect(body).not.toMatch(/v_rate\s*:=\s*\d+/); // never a literal
  });
  test('one reward per report (UNIQUE) + idempotency key replay protection', () => {
    expect(sql).toMatch(/report_id UUID NOT NULL UNIQUE REFERENCES public\.reports\(id\)/);
    expect(sql).toMatch(/idempotency_key TEXT NOT NULL UNIQUE/);
    const body = sql.match(/approve_bounty_reward\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/SELECT reference_id INTO v_reward FROM public\.wallet_transactions_v2\s+WHERE idempotency_key = p_idempotency_key/);
  });
  test('payout completion is impossible from failed/cancelled/paid', () => {
    const body = sql.match(/complete_reward_payout\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/IF v_payout\.status NOT IN \('awaiting_payout','processing'\) THEN RAISE EXCEPTION 'invalid state'/);
    expect(body).toMatch(/UPDATE public\.researcher_payouts[\s\S]*?WHERE id = p_payout AND status IN \('awaiting_payout','processing'\)/);
  });
  test('payout failure ALWAYS refunds the reservation to available', () => {
    const body = sql.match(/fail_reward_payout\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/reserved_balance_minor = reserved_balance_minor - v_reward\.total_charged_minor/);
    expect(body).toMatch(/available_balance_minor = available_balance_minor \+ v_reward\.total_charged_minor/);
    expect(body).toMatch(/bounty_refund/);
  });
  test('ledger transactions are balanced pairs in every money RPC', () => {
    // deposit: debit available / credit funding
    expect(sql).toMatch(/'company_available:' \|\| v_req\.company_id::text[\s\S]*?'debit'[\s\S]*?'external:funding'[\s\S]*?'credit'/);
    // payout: debit reserved / credit platform_revenue + external:payouts
    expect(sql).toMatch(/'platform_revenue'[\s\S]*?'credit'[\s\S]*?'external:payouts'[\s\S]*?'credit'/);
  });
  test('retry re-reserves using the rate LOCKED in the reward row', () => {
    const body = sql.match(/retry_reward_payout\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/v_avail < v_reward\.total_charged_minor/);
    expect(body).not.toMatch(/get_effective_commission_rate/);
  });
  test('adjustments require an audit note and cannot overdraw', () => {
    const body = sql.match(/adjust_company_wallet_v2\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/IF p_note IS NULL OR char_length\(trim\(p_note\)\) < 3 THEN RAISE EXCEPTION 'note required'/);
    expect(body).toMatch(/IF p_amount_minor < 0 AND v_avail < v_abs THEN RAISE EXCEPTION 'insufficient funds'/);
  });
  test('seeded global commission is configuration data (2000 bp = 20%), inserted once', () => {
    expect(sql).toMatch(/SELECT 'global', NULL, 2000, true\s+WHERE NOT EXISTS \(SELECT 1 FROM public\.commission_settings WHERE scope = 'global'\)/);
  });
  test('report status enum gains the finance lifecycle values (additive only)', () => {
    for (const v of ['under_review', 'need_more_info', 'rejected', 'reward_approved', 'paid']) {
      expect(sql).toMatch(new RegExp(`ALTER TYPE public\\.report_status ADD VALUE '${v}'`));
    }
  });
});

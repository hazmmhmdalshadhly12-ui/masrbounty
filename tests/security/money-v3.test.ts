import fs from 'fs';

/**
 * Money system v3 (migration 21) — structural security assertions:
 * every new money table must have RLS enabled with no client-write
 * policies on wallet balances, and deposit inserts must be restricted
 * to company money ranks with a forced 'pending' status.
 */
const sql = fs.readFileSync('supabase/migrations/21_money_system.sql', 'utf8');

describe('company wallets & ledger', () => {
  test('tables exist with non-negative balance guards', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.company_wallets \([\s\S]*?balance NUMERIC\(12,2\) DEFAULT 0 NOT NULL CHECK \(balance >= 0\)/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.company_wallet_transactions \([\s\S]*?CHECK \(amount <> 0\)/);
  });
  test('RLS enabled on both tables', () => {
    expect(sql).toMatch(/ALTER TABLE public\.company_wallets ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE public\.company_wallet_transactions ENABLE ROW LEVEL SECURITY/);
  });
  test('SELECT only for company members or admin — no client write policies', () => {
    const policies = sql.match(/CREATE POLICY "cw_[a-z_]+" ON public\.company_wallets[^;]*;/g) ?? [];
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) expect(p).toMatch(/FOR SELECT/);
    const txnPolicies = sql.match(/CREATE POLICY "cwt_[a-z_]+" ON public\.company_wallet_transactions[^;]*;/g) ?? [];
    for (const p of txnPolicies) expect(p).toMatch(/FOR SELECT/);
  });
  test('auto-created wallet for every new company + backfill for existing ones', () => {
    expect(sql).toMatch(/CREATE TRIGGER trg_company_wallet AFTER INSERT ON public\.company_profiles/);
    expect(sql).toMatch(/INSERT INTO public\.company_wallets\(company_id\)\s*\nSELECT id FROM public\.company_profiles/);
  });
});

describe('deposit requests', () => {
  test('RLS enabled', () => {
    expect(sql).toMatch(/ALTER TABLE public\.deposit_requests ENABLE ROW LEVEL SECURITY/);
  });
  test('company insert must be money-rank and forced pending', () => {
    expect(sql).toMatch(/CREATE POLICY "dr_insert" ON public\.deposit_requests FOR INSERT\s+WITH CHECK \(status = 'pending' AND public\.has_company_permission\(company_id, 'manage_payouts'\)\)/);
  });
  test('updates are admin-only; members see only their company', () => {
    expect(sql).toMatch(/CREATE POLICY "dr_admin_update" ON public\.deposit_requests FOR UPDATE\s+USING \(public\.has_role\('admin'\)\) WITH CHECK \(public\.has_role\('admin'\)\)/);
    expect(sql).toMatch(/CREATE POLICY "dr_select" ON public\.deposit_requests FOR SELECT\s+USING \(public\.has_role\('admin'\) OR public\.company_role\(company_id, auth\.uid\(\)\) IS NOT NULL\)/);
  });
});

describe('txn_type evolution', () => {
  test('adds the deposit txn type idempotently', () => {
    expect(sql).toMatch(/t\.typname = 'txn_type' AND e\.enumlabel = 'deposit'/);
    expect(sql).toMatch(/ALTER TYPE public\.txn_type ADD VALUE 'deposit'/);
  });
});

describe('security definer hygiene', () => {
  const fns = sql.match(/CREATE OR REPLACE FUNCTION public\.\w+\([^)]*\)[\s\S]*?LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;/g) ?? [];
  test('every new money RPC pins search_path', () => {
    // review_deposit, adjust_wallet, award_bounty, pay_award, settle_payout
    expect(fns.length).toBe(5);
  });
  test('the wallet trigger function is security definer', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.ensure_company_wallet\(\) RETURNS TRIGGER[\s\S]*?SECURITY DEFINER/);
  });
});

import fs from 'fs';

/**
 * Money system v4 (migration 22) — race-condition & RLS hardening:
 *  - every money RPC locks the row it decides on (SELECT ... FOR UPDATE)
 *    so double-clicks / parallel calls can never double-credit,
 *    double-debit, double-pay or double-refund;
 *  - wallet balance reads inside settle_payout are locked (lost-update fix);
 *  - refunds require proof of the original debit (anti money-printing);
 *  - payout INSERT policy forces status='pending' (anti forged-approved).
 */
const sql = fs.readFileSync('supabase/migrations/22_money_race_and_rls_fixes.sql', 'utf8');

describe('migration 22: payout INSERT policy', () => {
  test('pr_insert forces status=pending (forged approved rows rejected)', () => {
    expect(sql).toMatch(
      /CREATE POLICY "pr_insert" ON public\.payout_requests FOR INSERT\s+WITH CHECK \(\s*status = 'pending'/
    );
  });
  test('ownership check kept', () => {
    expect(sql).toMatch(/rp\.id = researcher_id AND rp\.user_id = auth\.uid\(\)/);
  });
});

describe('migration 22: row locks on money decisions', () => {
  test('award_bounty locks the report row (no double award/debit)', () => {
    expect(sql).toMatch(
      /SELECT program_id, researcher_id INTO v_program, v_researcher\s+FROM public\.reports WHERE id = p_report FOR UPDATE/
    );
  });
  test('pay_award locks the award row and locks the wallet row', () => {
    expect(sql).toMatch(
      /SELECT amount, status, report_id INTO v_amount, v_status, v_report\s+FROM public\.bounty_awards WHERE id = p_award FOR UPDATE/
    );
    expect(sql).toMatch(
      /SELECT id INTO v_wallet FROM public\.wallets WHERE researcher_id = v_researcher FOR UPDATE/
    );
  });
  test('pay_award never marks paid without crediting (wallet missing raises)', () => {
    expect(sql).toMatch(/-- F4: never mark an award paid without actually crediting the researcher/);
    expect(sql).toMatch(/IF v_wallet IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;/);
  });
  test('settle_payout locks the payout row', () => {
    expect(sql).toMatch(
      /SELECT \* INTO v_row FROM public\.payout_requests WHERE id = p_payout FOR UPDATE/
    );
  });
  test('settle_payout locks the wallet balance in BOTH approve and refund paths', () => {
    const locked = sql.match(
      /SELECT id, balance INTO v_wallet, v_nb FROM public\.wallets WHERE researcher_id = v_row\.researcher_id FOR UPDATE/g
    );
    expect(locked?.length).toBe(2);
  });
  test('review_deposit locks the deposit row (no double credit)', () => {
    expect(sql).toMatch(
      /SELECT \* INTO v_row FROM public\.deposit_requests WHERE id = p_deposit FOR UPDATE/
    );
  });
});

describe('migration 22: refund requires proof of debit', () => {
  test('cancel of an approved payout verifies the original negative payout txn', () => {
    expect(sql).toMatch(/WHERE reference_id = p_payout AND type = 'payout' AND amount < 0/);
    expect(sql).toMatch(/RAISE EXCEPTION 'no debit to refund'/);
  });
});

describe('migration 22: SECURITY DEFINER hygiene', () => {
  test('all four rewritten RPCs pin search_path', () => {
    const defs = sql.match(
      /CREATE OR REPLACE FUNCTION public\.\w+\([^)]*\)[\s\S]*?LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;/g
    ) ?? [];
    expect(defs.length).toBe(4);
    for (const name of ['award_bounty', 'pay_award', 'settle_payout', 'review_deposit']) {
      expect(sql).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`));
    }
  });
});

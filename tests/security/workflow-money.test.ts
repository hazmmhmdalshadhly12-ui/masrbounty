/**
 * Report workflow + money idempotency, asserted against the SQL definitions
 * that actually run in Supabase. Functions are (re)defined across layered
 * files — the LAST definition wins at runtime, so fn() resolves the final
 * version of each function:
 *   supabase/masrbounty.sql (base)
 *   → supabase/security-hardening-v2.sql (rank enforcement)
 *   → supabase/migrations/21_money_system.sql (prepaid wallets, 2-step payouts)
 *   → supabase/migrations/22_money_race_and_rls_fixes.sql (row locks, refund proof)
 */
import fs from 'fs';

const LAYERS = [
  'supabase/masrbounty.sql',
  'supabase/security-hardening-v2.sql',
  'supabase/migrations/21_money_system.sql',
  'supabase/migrations/22_money_race_and_rls_fixes.sql',
];

const sources = LAYERS.map((f) => fs.readFileSync(f, 'utf8'));

function fn(name: string): string {
  let found: string | null = null;
  for (const src of sources) {
    const re = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?END; \\$\\$ LANGUAGE plpgsql SECURITY DEFINER`);
    const m = src.match(re);
    if (m) found = m[0];
  }
  expect(found) /* `${name} must exist` */.not.toBeNull();
  return found!;
}

describe('report state machine: triage protection', () => {
  const trg = fn('protect_report_triage_fields');
  test('guards status, severity and bounty_amount', () => {
    for (const field of ['status', 'severity', 'bounty_amount']) {
      expect(trg).toMatch(new RegExp(`NEW\\.${field} IS DISTINCT FROM OLD\\.${field}`));
    }
  });
  test('admits only staff or company rank (owner/admin/triager/finance)', () => {
    expect(trg).toMatch(/has_role\('admin'\)/);
    expect(trg).toMatch(/has_role\('moderator'\)/);
    expect(trg).toMatch(/company_role\(p\.company_id, auth\.uid\(\)\) IN \('owner','admin','triager','finance'\)/);
  });
  test('researcher (reporter) self-mutation of triage fields raises', () => {
    expect(trg).toMatch(/RAISE EXCEPTION 'forbidden/);
  });
});

describe('bounty idempotency + prepaid funding: award_bounty (final v3)', () => {
  const award = fn('award_bounty');
  test('blocks a second award once approved or paid (no double award)', () => {
    expect(award).toMatch(/SELECT status INTO v_existing FROM public\.bounty_awards WHERE report_id = p_report/);
    expect(award).toMatch(/IF v_existing IN \('approved','paid'\) THEN RAISE EXCEPTION 'already awarded'/);
  });
  test('money movers need triage rank or admin — not mere membership', () => {
    expect(award).toMatch(/has_company_permission\(v_company, 'triage'\)/);
    expect(award).toMatch(/has_role\('admin'\)/);
  });
  test('rejects invalid amounts', () => {
    expect(award).toMatch(/p_amount IS NULL OR p_amount < 0/);
  });
  test('prepaid: debits the company wallet row-locked before crediting anyone', () => {
    expect(award).toMatch(/SELECT id, balance INTO v_cwallet, v_cbalance FROM public\.company_wallets WHERE company_id = v_company FOR UPDATE/);
    expect(award).toMatch(/IF v_cbalance < p_amount THEN RAISE EXCEPTION 'insufficient company balance'/);
    expect(award).toMatch(/total_spent = total_spent \+ p_amount/);
  });
  test('prepaid: writes a company ledger entry for the gross debit', () => {
    expect(award).toMatch(/INSERT INTO public\.company_wallet_transactions/);
  });
  test('writes an audit log entry', () => {
    expect(award).toMatch(/INSERT INTO public\.audit_logs/);
  });
});

describe('bounty idempotency + escrow release: pay_award (final v3)', () => {
  const pay = fn('pay_award');
  test('blocks double payment', () => {
    expect(pay).toMatch(/IF v_status = 'paid' THEN RAISE EXCEPTION 'already paid'/);
  });
  test('an award must be approved before any payment moves', () => {
    expect(pay).toMatch(/IF v_status <> 'approved' THEN RAISE EXCEPTION 'award not approved'/);
  });
  test('reference is optional (funds already held in escrow) but recorded when given', () => {
    expect(pay).toMatch(/v_ref := NULL/);
    expect(pay).toMatch(/v_ref := trim\(p_reference\)/);
  });
  test('finance rank enforced at the DB layer', () => {
    expect(pay).toMatch(/has_company_permission\(v_company, 'manage_payouts'\)/);
  });
});

describe('two-step payouts: settle_payout (final v3)', () => {
  const settle = fn('settle_payout');
  test('admin-only', () => {
    expect(settle).toMatch(/NOT public\.has_role\('admin'\) THEN RAISE EXCEPTION 'forbidden'/);
  });
  test('step 1 approve: debits balance and stops at approved (awaiting transfer)', () => {
    expect(settle).toMatch(/v_nb := v_nb - v_row\.amount/);
    expect(settle).toMatch(/status = 'approved', reviewed_by = v_uid/);
  });
  test('cancelling an approved payout refunds the reserved amount', () => {
    expect(settle).toMatch(/v_row\.status = 'approved' AND NOT p_approve/);
    expect(settle).toMatch(/balance \+ v_row\.amount/);
  });
  test('re-deciding a decided request raises', () => {
    expect(settle).toMatch(/RAISE EXCEPTION 'already decided'/);
  });
});

describe('deposits: review_deposit (final v3)', () => {
  const review = fn('review_deposit');
  test('admin-only', () => {
    expect(review).toMatch(/NOT public\.has_role\('admin'\) THEN RAISE EXCEPTION 'forbidden'/);
  });
  test('approve credits the company wallet and its ledger', () => {
    expect(review).toMatch(/total_funded = total_funded \+ v_row\.amount/);
    expect(review).toMatch(/'deposit', v_row\.amount/);
  });
  test('idempotent: a decided deposit cannot be re-decided', () => {
    expect(review).toMatch(/IF v_row\.status <> 'pending' THEN RAISE EXCEPTION 'already decided'/);
  });
});

describe('admin full control: adjust_wallet (final v3)', () => {
  const adj = fn('adjust_wallet');
  test('admin-only', () => {
    expect(adj).toMatch(/NOT public\.has_role\('admin'\) THEN RAISE EXCEPTION 'forbidden'/);
  });
  test('covers both researcher and company wallets, refuses zero amounts and empty notes', () => {
    expect(adj).toMatch(/p_subject = 'researcher'/);
    expect(adj).toMatch(/p_subject = 'company'/);
    expect(adj).toMatch(/p_amount IS NULL OR p_amount = 0 THEN RAISE EXCEPTION 'invalid amount'/);
    expect(adj).toMatch(/char_length\(trim\(p_note\)\) < 3 THEN RAISE EXCEPTION 'note required'/);
  });
  test('balances can never go negative through adjustments', () => {
    expect(adj).toMatch(/v_nb \+ p_amount < 0 THEN RAISE EXCEPTION 'insufficient balance'/);
  });
  test('every adjustment writes an audit row', () => {
    expect(adj).toMatch(/INSERT INTO public\.audit_logs/);
  });
});

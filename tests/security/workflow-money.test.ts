/**
 * Report workflow + money idempotency (Phase 6 acceptance), asserted against
 * the SQL definitions that actually run in Supabase:
 *  - triage fields (status/severity/bounty) can only be changed by company
 *    rank (owner/admin/triager/finance) or staff — DB trigger, not just UI
 *  - award_bounty: refuses already-approved/paid awards (no double award),
 *    enforces company triage permission, writes an audit row
 *  - pay_award: refuses already-paid, requires 'approved' state, requires a
 *    payment reference — a payout request alone is never proof of payment
 */
import fs from 'fs';

const v2 = fs.readFileSync('supabase/security-hardening-v2.sql', 'utf8');

function fn(name: string): string {
  const re = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?END; \\$\\$ LANGUAGE plpgsql SECURITY DEFINER;`);
  const m = v2.match(re);
  expect(m) /* `${name} must exist` */.not.toBeNull();
  return m![0];
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

describe('bounty idempotency: award_bounty', () => {
  const award = fn('award_bounty');
  test('blocks a second award once approved or paid', () => {
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
  test('writes an audit log entry', () => {
    expect(award).toMatch(/INSERT INTO public\.audit_logs/);
  });
});

describe('bounty idempotency: pay_award', () => {
  const pay = fn('pay_award');
  test('blocks double payment', () => {
    expect(pay).toMatch(/IF v_status = 'paid' THEN RAISE EXCEPTION 'already paid'/);
  });
  test('an award must be approved before any payment moves', () => {
    expect(pay).toMatch(/IF v_status <> 'approved' THEN RAISE EXCEPTION 'award not approved'/);
  });
  test('a payment reference is mandatory (request ≠ payment proof)', () => {
    expect(pay).toMatch(/p_reference IS NULL OR char_length\(trim\(p_reference\)\) = 0/);
    expect(pay).toMatch(/RAISE EXCEPTION 'reference required'/);
  });
  test('finance rank enforced at the DB layer', () => {
    expect(pay).toMatch(/has_company_permission\(v_company, 'manage_payouts'\)/);
  });
});

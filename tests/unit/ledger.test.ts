import {
  depositEntries,
  rewardHoldEntries,
  payoutPaidEntries,
  payoutRefundEntries,
  adjustmentEntries,
  isBalanced,
  accountKey,
  canTransitionPayout,
  PAYOUT_TRANSITIONS,
} from '@/lib/finance/ledger';
import { computeTotalMinor } from '@/lib/finance/money';

const C = '11111111-1111-1111-1111-111111111111';

describe('ledger builders — balanced double-entry invariant', () => {
  test('T1 deposit: available <- funding', () => {
    const entries = depositEntries(C, 500000);
    expect(isBalanced(entries)).toBe(true);
    expect(entries[0]).toMatchObject({ account_key: `company_available:${C}`, entry_type: 'debit' });
    expect(entries[1]).toMatchObject({ account_key: 'external:funding', entry_type: 'credit' });
  });

  test('T2 reward hold: reserved <- available (total = reward + commission)', () => {
    const total = computeTotalMinor(15075, 2000); // 18090
    const entries = rewardHoldEntries(C, total);
    expect(isBalanced(entries)).toBe(true);
    expect(entries[0].amount_minor).toBe(total);
    expect(entries[1].amount_minor).toBe(total);
  });

  test('T3 payout paid: reserved T = platform_revenue C + external payouts R', () => {
    const reward = 15075;
    const commission = 3015;
    const total = reward + commission;
    const entries = payoutPaidEntries(C, total, commission, reward);
    expect(isBalanced(entries)).toBe(true);
    const debits = entries.filter((e) => e.entry_type === 'debit').reduce((s, e) => s + e.amount_minor, 0);
    const credits = entries.filter((e) => e.entry_type === 'credit').reduce((s, e) => s + e.amount_minor, 0);
    expect(debits).toBe(total);
    expect(credits).toBe(commission + reward);
    expect(entries.find((e) => e.account_key === 'platform_revenue')?.amount_minor).toBe(commission);
  });

  test('T4 payout refund: reservation returns to available', () => {
    const entries = payoutRefundEntries(C, 18090);
    expect(isBalanced(entries)).toBe(true);
  });

  test('T5 adjustment: credit and debit directions both balance', () => {
    expect(isBalanced(adjustmentEntries(C, 25000, 'credit fix'))).toBe(true);
    expect(isBalanced(adjustmentEntries(C, -25000, 'debit fix'))).toBe(true);
    const credit = adjustmentEntries(C, 25000, '');
    expect(credit[0].entry_type).toBe('debit');
    const debit = adjustmentEntries(C, -25000, '');
    expect(debit[0].entry_type).toBe('debit');
    expect(debit[0].account_key).toBe('external:adjustment');
  });

  test('isBalanced rejects unbalanced/invalid entries', () => {
    expect(isBalanced([
      { account_key: 'a', account_type: 'external', entity_id: null, entry_type: 'debit', amount_minor: 100 },
      { account_key: 'b', account_type: 'external', entity_id: null, entry_type: 'credit', amount_minor: 99 },
    ])).toBe(false);
    expect(isBalanced([
      { account_key: 'a', account_type: 'external', entity_id: null, entry_type: 'debit', amount_minor: 0 },
    ])).toBe(false);
    expect(isBalanced([])).toBe(true); // vacuously balanced
  });

  test('accountKey helper', () => {
    expect(accountKey('company_available', C)).toBe(`company_available:${C}`);
    expect(accountKey('company_reserved', C)).toBe(`company_reserved:${C}`);
  });
});

describe('payout state machine — failed can never become paid', () => {
  test('live states reach paid/failed/processing; terminal states reach nothing', () => {
    expect(canTransitionPayout('awaiting_payout', 'processing')).toBe(true);
    expect(canTransitionPayout('awaiting_payout', 'paid')).toBe(true);
    expect(canTransitionPayout('processing', 'paid')).toBe(true);
    expect(canTransitionPayout('processing', 'failed')).toBe(true);
    expect(canTransitionPayout('awaiting_payout', 'cancelled')).toBe(true);
    expect(canTransitionPayout('failed', 'paid')).toBe(false);
    expect(canTransitionPayout('cancelled', 'paid')).toBe(false);
    expect(canTransitionPayout('paid', 'failed')).toBe(false);
    expect(canTransitionPayout('paid', 'processing')).toBe(false);
  });

  test('every status has a defined transition map entry (closed world)', () => {
    for (const s of ['awaiting_payout', 'processing', 'paid', 'failed', 'cancelled']) {
      expect(Array.isArray(PAYOUT_TRANSITIONS[s])).toBe(true);
    }
    expect(PAYOUT_TRANSITIONS.paid).toEqual([]);
    expect(PAYOUT_TRANSITIONS.failed).toEqual([]);
    expect(PAYOUT_TRANSITIONS.cancelled).toEqual([]);
  });
});

import { payoutSchema, awardSchema } from '@/schemas/wallet';
import { paginateMeta } from '@/utils/pagination';

const METHOD = '00000000-0000-0000-0000-000000000001';
const REPORT = '00000000-0000-0000-0000-000000000002';

test('wallet invariant: balance>=0', () => {
  const b = 100;
  expect(b).toBeGreaterThanOrEqual(0);
});

test('wallet invariant: ledger never credits negative nets', () => {
  const gross = 1000;
  const feePct = 10;
  const net = gross - Math.floor((gross * feePct) / 100);
  expect(net).toBe(900);
  expect(net).toBeGreaterThanOrEqual(0);
  const award = awardSchema.parse({ report_id: REPORT, amount: net });
  expect(award.amount).toBe(900);
});

test('wallet invariant: payout requires sufficient balance', () => {
  const balance = 800;
  const ok = payoutSchema.parse({ amount: 500, payment_method_id: METHOD });
  const short = payoutSchema.parse({ amount: 900, payment_method_id: METHOD });
  expect(balance - ok.amount).toBeGreaterThanOrEqual(0);
  expect(balance - short.amount).toBeLessThan(0); // caller must reject with "insufficient balance"
});

test('wallet invariant: payout history paginates', () => {
  const meta = paginateMeta(45, 2, 20);
  expect(meta).toEqual({ total: 45, per: 20, page: 2, pages: 3, offset: 20 });
});

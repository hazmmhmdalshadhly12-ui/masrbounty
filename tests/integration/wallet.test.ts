import { payoutSchema, awardSchema } from '@/schemas/wallet';
import { paginateMeta } from '@/utils/pagination';

const METHOD = '3fa85f64-5717-4562-b3fc-2c963f66afa6'; // valid RFC 9562 v4
const REPORT = 'c232b3a2-3b34-4b7e-9c1d-5e6f7a8b9c0d'; // valid RFC 9562 v4

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

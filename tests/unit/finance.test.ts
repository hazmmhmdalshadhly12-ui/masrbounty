import { depositSchema, adjustSchema } from '@/schemas/wallet';
import {
  num, money, moneyShort, feeSplit, aggregateMonthly, txnLabel, methodLabel,
} from '@/utils/finance';
import type { LedgerRowLike, RevenueRowLike } from '@/utils/finance';

const COMPANY = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('depositSchema', () => {
  test('accepts a valid deposit request', () => {
    const d = depositSchema.parse({ amount: 5000, method: 'vodafone_cash', reference: 'VF-123456', sender_name: '', note: '' });
    expect(d.amount).toBe(5000);
    expect(d.method).toBe('vodafone_cash');
  });
  test('rejects zero/negative amounts and short references', () => {
    expect(() => depositSchema.parse({ amount: 0, method: 'instapay', reference: 'VF-123' })).toThrow();
    expect(() => depositSchema.parse({ amount: -10, method: 'instapay', reference: 'VF-123' })).toThrow();
    expect(() => depositSchema.parse({ amount: 100, method: 'instapay', reference: 'ab' })).toThrow();
  });
  test('rejects unknown methods', () => {
    expect(() => depositSchema.parse({ amount: 100, method: 'paypal', reference: 'VF-123456' })).toThrow();
  });
  test('coerces numeric strings (form data)', () => {
    expect(depositSchema.parse({ amount: '750', method: 'bank', reference: 'TRF-99881' }).amount).toBe(750);
  });
});

describe('adjustSchema', () => {
  test('accepts credit and debit adjustments with a reason', () => {
    expect(adjustSchema.parse({ subject: 'researcher', id: COMPANY, amount: 250, note: 'تصحيح تحويل مكرر' }).amount).toBe(250);
    expect(adjustSchema.parse({ subject: 'company', id: COMPANY, amount: -100.5, note: 'خصم خطأ محاسبي' }).amount).toBe(-100.5);
  });
  test('rejects zero amounts, empty notes and bad uuids', () => {
    expect(() => adjustSchema.parse({ subject: 'researcher', id: COMPANY, amount: 0, note: 'سبب صالح' })).toThrow();
    expect(() => adjustSchema.parse({ subject: 'researcher', id: COMPANY, amount: 10, note: 'ab' })).toThrow();
    expect(() => adjustSchema.parse({ subject: 'researcher', id: 'nope', amount: 10, note: 'سبب صالح' })).toThrow();
    expect(() => adjustSchema.parse({ subject: 'wallet', id: COMPANY, amount: 10, note: 'سبب صالح' })).toThrow();
  });
});

describe('money formatting', () => {
  test('num() normalizes DB numerics (strings) and nulls', () => {
    expect(num('1234.5')).toBe(1234.5);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('NaN')).toBe(0);
  });
  test('money() always renders two decimals with grouping', () => {
    expect(money(0)).toBe('0.00');
    expect(money('12345.5')).toBe('12,345.50');
    expect(money(-250)).toBe('-250.00');
  });
  test('moneyShort() drops trailing zeros', () => {
    expect(moneyShort(12500)).toBe('12,500');
    expect(moneyShort('0')).toBe('0');
  });
});

describe('feeSplit — mirrors award_bounty', () => {
  test('splits gross into fee and net at 10%', () => {
    expect(feeSplit(1000, 10)).toEqual({ fee: 100, net: 900 });
  });
  test('clamps the percent into 0..50', () => {
    expect(feeSplit(1000, 80)).toEqual({ fee: 500, net: 500 });
    expect(feeSplit(1000, -5)).toEqual({ fee: 0, net: 1000 });
  });
  test('zero gross produces no fee and no net', () => {
    expect(feeSplit(0, 10)).toEqual({ fee: 0, net: 0 });
  });
  test('invariant: fee + net == gross (no money created or lost)', () => {
    for (const gross of [0, 1, 99.99, 5000, 123456.78]) {
      const { fee, net } = feeSplit(gross, 12.5);
      expect(fee + net).toBeCloseTo(gross, 2);
    }
  });
});

describe('aggregateMonthly — financial report buckets', () => {
  const deposits: LedgerRowLike[] = [
    { amount: 1000, created_at: '2026-11-02T10:00:00Z' },
    { amount: 500, created_at: '2026-11-20T10:00:00Z' },
    { amount: -9999, created_at: '2026-01-01T10:00:00Z' }, // outside window, ignored
  ];
  const revenue: RevenueRowLike[] = [
    { gross_amount: 300, fee_amount: 30, net_amount: 270, created_at: '2026-11-05T10:00:00Z' },
  ];
  const payouts: LedgerRowLike[] = [
    { amount: -120, created_at: '2026-11-15T10:00:00Z' }, // negative stored, reported as absolute
  ];

  test('buckets the last N months oldest-first and ignores out-of-window rows', () => {
    const buckets = aggregateMonthly(deposits, revenue, payouts, 3);
    expect(buckets).toHaveLength(3);
    const last = buckets[buckets.length - 1];
    expect(last.key).toBe('2026-11');
    expect(last.deposits).toBe(1500);
    expect(last.gross).toBe(300);
    expect(last.fee).toBe(30);
    expect(last.net).toBe(270);
    expect(last.payouts).toBe(120);
  });
  test('handles null inputs', () => {
    const buckets = aggregateMonthly(null, null, null, 2);
    expect(buckets).toHaveLength(2);
    expect(buckets[1].deposits).toBe(0);
  });
});

describe('labels', () => {
  test('txn and method labels are Arabic and total', () => {
    expect(txnLabel('bounty')).toBe('مكافأة');
    expect(txnLabel('deposit')).toBe('إيداع');
    expect(txnLabel('adjustment')).toBe('تسوية');
    expect(methodLabel('vodafone_cash')).toBe('فودافون كاش');
    expect(methodLabel('unknown-x')).toBe('unknown-x');
  });
});

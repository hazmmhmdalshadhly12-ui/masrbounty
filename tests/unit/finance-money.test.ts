import {
  egpToMinor,
  minorToEgp,
  formatMinor,
  computeCommissionMinor,
  computeTotalMinor,
  bpToPercent,
  isMinor,
  PIASTRES_PER_EGP,
  MAX_MINOR,
} from '@/lib/finance/money';

describe('integer money core (piastres)', () => {
  test('egpToMinor converts EGP strings to exact integer piastres', () => {
    expect(egpToMinor('150')).toBe(15000);
    expect(egpToMinor('150.5')).toBe(15050);
    expect(egpToMinor('150.75')).toBe(15075);
    expect(egpToMinor('0.01')).toBe(1);
    expect(egpToMinor('1,234.56')).toBe(123456);
    expect(egpToMinor(20)).toBe(2000);
  });

  test('egpToMinor rejects garbage, negatives, zero and >2 decimals', () => {
    expect(egpToMinor('abc')).toBeNull();
    expect(egpToMinor('')).toBeNull();
    expect(egpToMinor('0')).toBeNull();
    expect(egpToMinor('-5')).toBeNull();
    expect(egpToMinor('1.234')).toBeNull(); // silent rounding forbidden
    expect(egpToMinor('12a')).toBeNull();
    expect(egpToMinor('')).toBeNull();
    expect(egpToMinor('  ')).toBeNull();
  });

  test('isMinor accepts only positive integers within cap', () => {
    expect(isMinor(1)).toBe(true);
    expect(isMinor(MAX_MINOR)).toBe(true);
    expect(isMinor(0)).toBe(false);
    expect(isMinor(-1)).toBe(false);
    expect(isMinor(1.5)).toBe(false);
    expect(isMinor(MAX_MINOR + 1)).toBe(false);
    expect(isMinor('100')).toBe(false);
    expect(isMinor(Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  test('round-trip minor->major is exact (no float drift)', () => {
    for (const minor of [1, 5, 99, 100, 2500, 12345, 999999999]) {
      expect(Math.round(minorToEgp(minor) * PIASTRES_PER_EGP)).toBe(minor);
    }
  });

  test('formatMinor renders grouped EGP display strings', () => {
    expect(formatMinor(15075)).toBe('150.75');
    expect(formatMinor(123456789)).toBe('1,234,567.89');
    expect(formatMinor(5)).toBe('0.05');
    expect(formatMinor(-250)).toBe('-2.50');
  });

  test('commission = floor(reward * bp / 10000), integer-only', () => {
    expect(computeCommissionMinor(15075, 2000)).toBe(3015); // 20% of 150.75 EGP
    expect(computeCommissionMinor(10000, 0)).toBe(0);
    expect(computeCommissionMinor(10000, 10000)).toBe(10000);
    expect(computeCommissionMinor(9999, 2000)).toBe(Math.floor(9999 * 0.2)); // 1999 (floored)
    expect(computeCommissionMinor(3333, 1234)).toBe(Math.floor((3333 * 1234) / 10000));
  });

  test('commission never drifts into floats', () => {
    const c = computeCommissionMinor(1234567, 2000);
    expect(Number.isInteger(c)).toBe(true);
    expect(c).toBe(246913); // floor(246913.4)
  });

  test('invalid inputs yield zero commission (defensive)', () => {
    expect(computeCommissionMinor(0, 2000)).toBe(0);
    expect(computeCommissionMinor(-5, 2000)).toBe(0);
    expect(computeCommissionMinor(100, 10001)).toBe(0);
    expect(computeCommissionMinor(100, -1)).toBe(0);
    expect(computeCommissionMinor(1.5, 2000)).toBe(0);
  });

  test('total = reward + commission', () => {
    const reward = 15075;
    const total = computeTotalMinor(reward, 2000);
    expect(total).toBe(reward + 3015);
  });

  test('bpToPercent renders clean percents', () => {
    expect(bpToPercent(2000)).toBe('20');
    expect(bpToPercent(1250)).toBe('12.5');
    expect(bpToPercent(0)).toBe('0');
    expect(bpToPercent(10000)).toBe('100');
    expect(bpToPercent(123)).toBe('1.23');
  });
});

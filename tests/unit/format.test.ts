import { shortId, fmtEGP, fmtDate, truncate } from '@/utils/format';

test('shortId', () => {
  expect(shortId('abcdefghij')).toBe('abcdefgh');
});

test('shortId passes through short strings', () => {
  expect(shortId('abc')).toBe('abc');
  expect(shortId('')).toBe('');
});

test('fmtEGP formats pounds and guards NaN', () => {
  expect(fmtEGP(1500)).toContain('ج');
  expect(fmtEGP(NaN)).toBe(fmtEGP(0));
});

test('fmtDate round-trips valid dates, echoes garbage', () => {
  expect(fmtDate('not-a-date')).toBe('not-a-date');
  expect(fmtDate('2024-01-15T00:00:00.000Z')).not.toBe('2024-01-15T00:00:00.000Z');
});

test('truncate shortens with ellipsis', () => {
  expect(truncate('hello', 10)).toBe('hello');
  expect(truncate('hello world', 6)).toBe('hello…');
});

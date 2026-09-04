import { rateLimit } from '@/lib/rate-limit';

test('blocks after max hits in window', () => {
  const key = `test-${Date.now()}`;
  expect(rateLimit(key, 2, 60_000).ok).toBe(true);
  expect(rateLimit(key, 2, 60_000).ok).toBe(true);
  const third = rateLimit(key, 2, 60_000);
  expect(third.ok).toBe(false);
  expect(third.retryAfterSec).toBeGreaterThan(0);
});

test('different keys are independent', () => {
  const a = `a-${Date.now()}`;
  const b = `b-${Date.now()}`;
  expect(rateLimit(a, 1, 60_000).ok).toBe(true);
  expect(rateLimit(a, 1, 60_000).ok).toBe(false);
  expect(rateLimit(b, 1, 60_000).ok).toBe(true);
});

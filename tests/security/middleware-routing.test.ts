/** @jest-environment node */

/**
 * Middleware routing matrix (Phase 2 acceptance):
 *  - guests can reach public read APIs (programs/search/leaderboard/health)
 *  - webhooks are reachable without a user cookie (secret-authed in-route)
 *  - everything else under /api requires a cookie presence signal
 *  - safeNext / CSRF behavior stays intact
 */
import { isPublicApiPath, isSafeNext } from '@/middleware';

describe('middleware: public API allowlist', () => {
  test('guests may GET public program/search/leaderboard endpoints', () => {
    expect(isPublicApiPath('/api/programs', 'GET')).toBe(true);
    expect(isPublicApiPath('/api/programs/abc-id', 'GET')).toBe(true);
    expect(isPublicApiPath('/api/search', 'GET')).toBe(true);
    expect(isPublicApiPath('/api/leaderboard', 'GET')).toBe(true);
    expect(isPublicApiPath('/api/health', 'GET')).toBe(true);
  });

  test('guests may reach webhook endpoints regardless of method (secret checked in-route)', () => {
    expect(isPublicApiPath('/api/webhooks/supabase', 'POST')).toBe(true);
    expect(isPublicApiPath('/api/webhooks/supabase', 'GET')).toBe(true);
  });

  test('mutating methods on public data APIs are NOT guest-allowed', () => {
    expect(isPublicApiPath('/api/programs', 'POST')).toBe(false);
    expect(isPublicApiPath('/api/search', 'DELETE')).toBe(false);
    expect(isPublicApiPath('/api/leaderboard', 'PUT')).toBe(false);
  });

  test('sensitive endpoints stay cookie-gated', () => {
    expect(isPublicApiPath('/api/payouts', 'POST')).toBe(false);
    expect(isPublicApiPath('/api/payouts', 'GET')).toBe(false);
    expect(isPublicApiPath('/api/wallet', 'GET')).toBe(false);
    expect(isPublicApiPath('/api/reports', 'GET')).toBe(false);
    expect(isPublicApiPath('/api/messages', 'GET')).toBe(false);
    expect(isPublicApiPath('/api/verify-domain', 'POST')).toBe(false);
    expect(isPublicApiPath('/api/notifications', 'GET')).toBe(false);
    expect(isPublicApiPath('/api/auth/session', 'GET')).toBe(false);
  });

  test('path confusion cannot reach the allowlist', () => {
    expect(isPublicApiPath('/api/programs/../payouts', 'GET')).toBe(false); // not normalized, not matching regex
    expect(isPublicApiPath('/API/programs', 'GET')).toBe(false);
    expect(isPublicApiPath('/api/searchX', 'GET')).toBe(false);
    expect(isPublicApiPath('/api/webhooks/../wallet', 'GET')).toBe(false);
  });
});

describe('middleware: safeNext (open-redirect guard)', () => {
  test('accepts internal paths', () => {
    expect(isSafeNext('/dashboard')).toBe('/dashboard');
    expect(isSafeNext('/programs/x?y=1')).toBe('/programs/x?y=1');
  });
  test('rejects external, protocol-relative, encoded and API targets', () => {
    expect(isSafeNext('https://evil.com')).toBeNull();
    expect(isSafeNext('//evil.com')).toBeNull();
    expect(isSafeNext('javascript:alert(1)')).toBeNull();
    expect(isSafeNext('/\\evil.com')).toBeNull();
    expect(isSafeNext('/api/wallet')).toBeNull();
    expect(isSafeNext(null)).toBeNull();
  });
});

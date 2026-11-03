/** @jest-environment node */

/**
 * Webhook authentication (Phase 2 / Security acceptance):
 *  - missing secret configured on server -> 500 (fail closed)
 *  - missing/wrong secret header -> 401
 *  - correct secret -> 200
 *  - timing-safe comparison is constant-digest and detects mismatches
 */
import { POST } from '@/app/api/webhooks/supabase/route';
import { timingSafeEqualStrings } from '@/lib/security/edge-crypto';

function postReq(headers: Record<string, string>, body?: string): Request {
  return new Request('https://masrbounty.online/api/webhooks/supabase', {
    method: 'POST',
    headers,
    body: body ?? JSON.stringify({ type: 'test', table: 'profiles' }),
  });
}

describe('webhook: secret verification', () => {
  const OLD = process.env.SUPABASE_WEBHOOK_SECRET;
  afterEach(() => {
    if (OLD === undefined) delete process.env.SUPABASE_WEBHOOK_SECRET;
    else process.env.SUPABASE_WEBHOOK_SECRET = OLD;
  });

  test('500 when the webhook is not configured', async () => {
    delete process.env.SUPABASE_WEBHOOK_SECRET;
    const res = await POST(postReq({ 'x-webhook-secret': 'anything' }));
    expect(res.status).toBe(500);
  });

  test('401 without a secret header', async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = 's3cret';
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  test('401 with a wrong secret (both header spellings)', async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = 's3cret';
    expect((await POST(postReq({ 'x-webhook-secret': 'wrong' }))).status).toBe(401);
    expect((await POST(postReq({ 'x-supabase-webhook-secret': 'wrong' }))).status).toBe(401);
  });

  test('200 with the correct secret on either header', async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = 's3cret';
    expect((await POST(postReq({ 'x-webhook-secret': 's3cret' }))).status).toBe(200);
    expect((await POST(postReq({ 'x-supabase-webhook-secret': 's3cret' }))).status).toBe(200);
  });

  test('400 with invalid JSON once authorized', async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = 's3cret';
    const res = await POST(postReq({ 'x-webhook-secret': 's3cret' }, 'not-json{'));
    expect(res.status).toBe(400);
  });

  test('wrong secret header value never leaks the configured secret', async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = 's3cret-value';
    const res = await POST(postReq({ 'x-webhook-secret': 'wrong' }));
    const text = await res.text();
    expect(text).not.toContain('s3cret-value');
  });
});

describe('timingSafeEqualStrings', () => {
  test('equal strings match, unequal do not (even by length)', async () => {
    expect(await timingSafeEqualStrings('abc', 'abc')).toBe(true);
    expect(await timingSafeEqualStrings('abc', 'abd')).toBe(false);
    expect(await timingSafeEqualStrings('abc', 'abcd')).toBe(false);
    expect(await timingSafeEqualStrings('', '')).toBe(true);
    expect(await timingSafeEqualStrings('', 'x')).toBe(false);
  });

  test('arabic/unicode secrets compare correctly', async () => {
    expect(await timingSafeEqualStrings('سر-سري', 'سر-سري')).toBe(true);
    expect(await timingSafeEqualStrings('سر-سري', 'سر-سري2')).toBe(false);
  });
});

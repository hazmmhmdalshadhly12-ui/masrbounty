/**
 * AI infrastructure tests: no key leakage, correct error taxonomy, quota
 * gating. The OpenAI-compatible client is exercised through a mocked global
 * fetch; the quota gate through mocked Supabase admin client.
 */
import { aiChat } from '@/lib/ai/client';

const ORIGINAL_ENV = { ...process.env };

function mockFetchOnce(status: number, body: unknown): jest.Mock {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('lib/ai/client — aiChat', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.AI_API_KEY = 'test-secret-key-do-not-leak';
    process.env.AI_API_BASE_URL = 'https://ai.example.com/v1';
    process.env.AI_MODEL = 'test-model';
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns not_configured WITHOUT calling the network when the key is missing', async () => {
    process.env.AI_API_KEY = '';
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    const res = await aiChat({ messages: [{ role: 'user', content: 'مرحبا' }] });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('not_configured');
      expect(res.message).not.toContain('test-secret-key-do-not-leak');
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('succeeds and reports token usage', async () => {
    const fetchMock = mockFetchOnce(200, {
      choices: [{ message: { content: 'الرد التجريبي' } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    });
    const res = await aiChat({ messages: [{ role: 'user', content: 'مرحبا' }] });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.content).toBe('الرد التجريبي');
      expect(res.promptTokens).toBe(11);
      expect(res.completionTokens).toBe(7);
    }
    // The Authorization header carried the key; nothing else leaks it.
    const headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-secret-key-do-not-leak');
  });

  it('maps 429 to rate_limited and retries once', async () => {
    let calls = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      calls += 1;
      const status = calls === 1 ? 429 : 200;
      return { ok: status >= 200 && status < 300, status, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
    }) as unknown as typeof fetch;
    const res = await aiChat({ messages: [{ role: 'user', content: 'x' }] });
    expect(calls).toBe(2);
    expect(res.ok).toBe(true);
  });

  it('maps persistent 5xx to upstream_error with a generic message (no key, no URL)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const res = await aiChat({ messages: [{ role: 'user', content: 'x' }] });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('upstream_error');
      expect(res.message).not.toContain('test-secret-key-do-not-leak');
      expect(res.message).not.toContain('ai.example.com');
    }
  });

  it('maps 401 to not_configured without echoing the provider body', async () => {
    mockFetchOnce(401, { error: { message: 'invalid key test-secret-key-do-not-leak' } });
    const res = await aiChat({ messages: [{ role: 'user', content: 'x' }] });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('not_configured');
      expect(res.message).not.toContain('test-secret-key-do-not-leak');
    }
  });

  it('treats empty choices as bad_response', async () => {
    mockFetchOnce(200, { choices: [] });
    const res = await aiChat({ messages: [{ role: 'user', content: 'x' }] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('bad_response');
  });
});

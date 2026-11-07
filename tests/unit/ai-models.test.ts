/**
 * Admin model picker tests:
 *  - model-name validation (aiSetDefaultModelAction input guard);
 *  - parsing of provider /models responses (OpenAI + Gemini shapes);
 *  - fetchProviderModels failure classification (status / timeout);
 *  - resolveEffectiveAiModel precedence: admin choice > env default,
 *    including the allowed_models allow-list fallback.
 */
import {
  isValidModelName,
  parseModelsList,
  fetchProviderModels,
} from '@/lib/ai/models';

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

function mockAiSettingsRow(row: Record<string, unknown> | null): void {
  const { createAdminClient } = require('@/lib/supabase/admin') as { createAdminClient: jest.Mock };
  createAdminClient.mockReturnValue({
    from: (table: string) => {
      if (table === 'ai_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: row }),
            }),
          }),
        };
      }
      throw new Error('unexpected table ' + table);
    },
  });
}

describe('isValidModelName', () => {
  it('accepts realistic provider model ids', () => {
    for (const name of ['gemini-2.5-flash', 'gpt-4o-mini', 'openai/gpt-4o-mini', 'llama-3.3-70b-versatile:free', 'Qwen2.5-72B-Instruct']) {
      expect(isValidModelName(name)).toBe(true);
    }
  });

  it('rejects empty, spaced, non-ASCII and oversized names', () => {
    for (const name of ['', '   ', 'gpt 4o', 'نموذج-عربي', 'gpt\t4', '-starts-with-dash', 'x'.repeat(121)]) {
      expect(isValidModelName(name)).toBe(false);
    }
  });
});

describe('parseModelsList', () => {
  it('parses the OpenAI shape and sorts the ids', () => {
    expect(
      parseModelsList({ data: [{ id: 'gemini-2.5-flash' }, { id: 'gemini-2.0-flash' }, { object: 'model' }] })
    ).toEqual(['gemini-2.0-flash', 'gemini-2.5-flash']);
  });

  it('strips the leading models/ prefix (Gemini ids) and de-duplicates', () => {
    expect(
      parseModelsList({ data: [{ id: 'models/gemini-2.5-flash' }, { id: 'gemini-2.5-flash' }, { id: 'models/gemini-2.0-flash' }] })
    ).toEqual(['gemini-2.0-flash', 'gemini-2.5-flash']);
  });

  it('understands the Gemini native shape ({ models: [{ name }] })', () => {
    expect(parseModelsList({ models: [{ name: 'models/gemini-2.5-flash' }] })).toEqual(['gemini-2.5-flash']);
  });

  it('returns [] for empty, null or unrecognized payloads', () => {
    expect(parseModelsList({ data: [] })).toEqual([]);
    expect(parseModelsList(null)).toEqual([]);
    expect(parseModelsList({ error: { message: 'x' } })).toEqual([]);
    expect(parseModelsList('nope')).toEqual([]);
  });
});

describe('fetchProviderModels', () => {
  it('returns ok + json on 200', async () => {
    const json = { data: [{ id: 'gemini-2.5-flash' }] };
    const impl = (async () => ({ ok: true, status: 200, json: async () => json })) as unknown as typeof fetch;
    const res = await fetchProviderModels('https://prov.example/v1', 'k', impl);
    expect(res).toEqual({ ok: true, json });
  });

  it('classifies non-ok statuses without parsing the body', async () => {
    const impl = (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    const res = await fetchProviderModels('https://prov.example/v1', 'k', impl);
    expect(res).toEqual({ ok: false, httpStatus: 404 });
  });

  it('maps an abort to a timeout result', async () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    const impl = (async () => {
      throw abort;
    }) as unknown as typeof fetch;
    const res = await fetchProviderModels('https://prov.example/v1', 'k', impl);
    expect(res).toEqual({ ok: false, timeout: true });
  });

  it('maps a plain network rejection to a non-timeout failure', async () => {
    const impl = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const res = await fetchProviderModels('https://prov.example/v1', 'k', impl);
    expect(res).toEqual({ ok: false, timeout: false });
  });
});

describe('resolveEffectiveAiModel — admin choice precedence', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_API_BASE_URL = 'https://ai.example.com/v1';
    process.env.AI_MODEL = 'env-model';
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  async function resolve(): Promise<{ model: string; source: 'admin' | 'env' }> {
    const { resolveEffectiveAiModel } = await import('@/lib/ai/service');
    return resolveEffectiveAiModel();
  }

  it('uses the admin default_model when set', async () => {
    mockAiSettingsRow({ enabled: true, daily_limit_per_user: 25, per_minute_limit: 6, monthly_budget_requests: 20000, allowed_features: ['report_assistant'], allowed_models: [], default_model: 'admin-chosen-model' });
    expect(await resolve()).toEqual({ model: 'admin-chosen-model', source: 'admin' });
  });

  it('falls back to the env model when the admin choice is not in allowed_models', async () => {
    mockAiSettingsRow({ enabled: true, daily_limit_per_user: 25, per_minute_limit: 6, monthly_budget_requests: 20000, allowed_features: ['report_assistant'], allowed_models: ['some-other-model'], default_model: 'admin-chosen-model' });
    expect(await resolve()).toEqual({ model: 'env-model', source: 'env' });
  });

  it('uses the env model when default_model is null', async () => {
    mockAiSettingsRow({ enabled: true, daily_limit_per_user: 25, per_minute_limit: 6, monthly_budget_requests: 20000, allowed_features: ['report_assistant'], allowed_models: [], default_model: null });
    expect(await resolve()).toEqual({ model: 'env-model', source: 'env' });
  });

  it('uses the env model when the settings row is missing', async () => {
    mockAiSettingsRow(null);
    expect(await resolve()).toEqual({ model: 'env-model', source: 'env' });
  });
});

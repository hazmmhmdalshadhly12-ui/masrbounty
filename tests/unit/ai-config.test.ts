/**
 * AI env config tests: alias resolution, provider defaults, base-URL
 * normalization, and the diagnostics snapshot (names only — never values).
 */
import { getAiEnvConfig, getAiEnvDiagnostics, normalizeBaseUrl } from '@/lib/ai/config';

const ORIGINAL_ENV = { ...process.env };

describe('lib/ai/config — env resolution', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ZAI_API_KEY;
    delete process.env.Z_AI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.AI_API_BASE_URL;
    delete process.env.ZAI_API_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_API_BASE;
    delete process.env.AI_MODEL;
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('is not configured when no accepted key variable is set', () => {
    expect(getAiEnvConfig().configured).toBe(false);
  });

  it('uses the canonical AI_API_KEY with OpenAI defaults', () => {
    process.env.AI_API_KEY = 'k';
    const c = getAiEnvConfig();
    expect(c.configured).toBe(true);
    expect(c.baseUrl).toBe('https://api.openai.com/v1');
    expect(c.model).toBe('gpt-4o-mini');
    expect(c.keyVar).toBe('AI_API_KEY');
  });

  it('falls back to OPENAI_API_KEY when AI_API_KEY is absent', () => {
    process.env.OPENAI_API_KEY = 'k';
    const c = getAiEnvConfig();
    expect(c.configured).toBe(true);
    expect(c.keyVar).toBe('OPENAI_API_KEY');
    expect(c.baseUrl).toBe('https://api.openai.com/v1');
  });

  it('infers Z.ai provider defaults from a ZAI_API_KEY variable', () => {
    process.env.ZAI_API_KEY = 'k';
    const c = getAiEnvConfig();
    expect(c.configured).toBe(true);
    expect(c.baseUrl).toBe('https://api.z.ai/api/paas/v4');
    expect(c.model).toBe('glm-4.6');
  });

  it('infers OpenRouter defaults from OPENROUTER_API_KEY', () => {
    process.env.OPENROUTER_API_KEY = 'k';
    const c = getAiEnvConfig();
    expect(c.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(c.model).toBe('openai/gpt-4o-mini');
  });

  it('prefers the canonical key over aliases', () => {
    process.env.AI_API_KEY = 'canonical';
    process.env.OPENAI_API_KEY = 'alias';
    const c = getAiEnvConfig();
    expect(c.keyVar).toBe('AI_API_KEY');
  });

  it('explicit AI_API_BASE_URL wins over the provider default', () => {
    process.env.ZAI_API_KEY = 'k';
    process.env.AI_API_BASE_URL = 'https://proxy.example.com/v1/';
    const c = getAiEnvConfig();
    expect(c.baseUrl).toBe('https://proxy.example.com/v1');
  });

  it('normalizes a pasted full endpoint and trailing slashes', () => {
    expect(normalizeBaseUrl('https://api.x.com/v1/')).toBe('https://api.x.com/v1');
    expect(normalizeBaseUrl('https://api.x.com/v1/chat/completions')).toBe('https://api.x.com/v1');
    expect(normalizeBaseUrl('https://api.x.com/v1/chat/completions///')).toBe('https://api.x.com/v1');
  });

  it('repairs a bare Gemini host to the OpenAI-compat path', () => {
    expect(normalizeBaseUrl('https://generativelanguage.googleapis.com')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai'
    );
  });

  it('repairs a Gemini /v1beta or /v1 URL (native generateContent root) to the OpenAI-compat path', () => {
    expect(normalizeBaseUrl('https://generativelanguage.googleapis.com/v1beta')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai'
    );
    expect(normalizeBaseUrl('https://generativelanguage.googleapis.com/v1')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai'
    );
  });

  it('is idempotent for an already-correct Gemini OpenAI-compat URL', () => {
    expect(normalizeBaseUrl('https://generativelanguage.googleapis.com/v1beta/openai')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai'
    );
    expect(normalizeBaseUrl('https://generativelanguage.googleapis.com/v1beta/openai/')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai'
    );
  });

  it('prefixes https:// when the scheme was omitted', () => {
    expect(normalizeBaseUrl('generativelanguage.googleapis.com')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai'
    );
    expect(normalizeBaseUrl('api.openai.com/v1')).toBe('https://api.openai.com/v1');
  });

  it('infers Gemini provider defaults from a GEMINI_API_KEY variable', () => {
    process.env.GEMINI_API_KEY = 'k';
    const c = getAiEnvConfig();
    expect(c.configured).toBe(true);
    expect(c.keyVar).toBe('GEMINI_API_KEY');
    expect(c.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
    expect(c.model).toBe('gemini-2.5-flash');
  });

  it('AI_MODEL overrides the provider default model', () => {
    process.env.ZAI_API_KEY = 'k';
    process.env.AI_MODEL = 'glm-4-plus';
    expect(getAiEnvConfig().model).toBe('glm-4-plus');
  });

  it('diagnostics report which variable names are present — never values', () => {
    process.env.OPENAI_API_KEY = 'secret-value-must-not-appear';
    const d = getAiEnvDiagnostics();
    expect(d.configured).toBe(true);
    expect(d.keyVar).toBe('OPENAI_API_KEY');
    expect(d.keyVarsPresent['OPENAI_API_KEY']).toBe(true);
    expect(d.keyVarsPresent['AI_API_KEY']).toBe(false);
    expect(JSON.stringify(d)).not.toContain('secret-value-must-not-appear');
  });
});

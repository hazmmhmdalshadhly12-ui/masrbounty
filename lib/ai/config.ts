/**
 * AI environment configuration — SERVER ONLY.
 *
 * The API key lives exclusively in Cloudflare Pages environment variables.
 * It is NEVER imported into a client component, NEVER returned from an
 * action, NEVER logged. Every AI request goes through lib/ai/client.ts.
 *
 * Robustness rules (added after the "AI is not working" production report):
 *  1. The key is resolved from a list of ACCEPTED VARIABLE NAMES — admins
 *     frequently add the secret under `OPENAI_API_KEY` / `ZAI_API_KEY` etc.
 *     instead of the canonical `AI_API_KEY`; previously that silently read as
 *     "not configured".
 *  2. When the base URL is not set explicitly, it is inferred from WHICH key
 *     variable matched (a Z.ai key under `ZAI_API_KEY` must not be sent to
 *     api.openai.com). An explicit AI_API_BASE_URL always wins.
 *  3. The base URL is normalized: trailing slashes and a trailing
 *     `/chat/completions` (copy-pasted full endpoint) are stripped — the
 *     client appends the path itself.
 *  4. Changing environment variables in Cloudflare Pages takes effect only on
 *     the NEXT deployment — the setup hint says so explicitly.
 */

export type AiEnvConfig = {
  /** True when a key was found under any accepted name and a base URL resolved. */
  configured: boolean;
  /** OpenAI-compatible base URL (no version-less, no trailing endpoint path). */
  baseUrl: string;
  /** Default model id (overridable per-request / by admin settings). */
  model: string;
  /** Hard clamp on user-supplied input characters per request. */
  maxInputChars: number;
  /** Name of the env var the API key was found under ('' when missing). */
  keyVar: string;
};

/** Server-only credentials — never export this type into client code. */
export type AiCredentials = {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Env var name the key came from ('' when none matched). */
  keyVar: string;
};

/** Accepted key variable names, in priority order. */
export const AI_KEY_VARS = [
  'AI_API_KEY',
  'OPENAI_API_KEY',
  'ZAI_API_KEY',
  'Z_AI_API_KEY',
  'OPENROUTER_API_KEY',
  'GROQ_API_KEY',
] as const;

/** Accepted base-URL variable names, in priority order. */
export const AI_BASE_URL_VARS = ['AI_API_BASE_URL', 'ZAI_API_BASE_URL', 'OPENAI_BASE_URL', 'OPENAI_API_BASE'] as const;

type ProviderDefault = { baseUrl: string; model: string };

const PROVIDER_DEFAULTS: Record<string, ProviderDefault> = {
  AI_API_KEY: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  OPENAI_API_KEY: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  ZAI_API_KEY: { baseUrl: 'https://api.z.ai/api/paas/v4', model: 'glm-4.6' },
  Z_AI_API_KEY: { baseUrl: 'https://api.z.ai/api/paas/v4', model: 'glm-4.6' },
  OPENROUTER_API_KEY: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  GROQ_API_KEY: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
};

function readEnv(name: string): string {
  return (process.env as Record<string, string | undefined>)[name]?.trim() ?? '';
}

/** Strip copy-paste artifacts: trailing slashes and the endpoint path itself. */
export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  if (url.toLowerCase().endsWith('/chat/completions')) url = url.slice(0, -'/chat/completions'.length).replace(/\/+$/, '');
  return url;
}

function resolveCredentials(): AiCredentials {
  let keyVar = '';
  let apiKey = '';
  for (const name of AI_KEY_VARS) {
    const v = readEnv(name);
    if (v) {
      keyVar = name;
      apiKey = v;
      break;
    }
  }
  const provider = PROVIDER_DEFAULTS[keyVar] ?? PROVIDER_DEFAULTS['AI_API_KEY'];

  let explicitBase = '';
  for (const name of AI_BASE_URL_VARS) {
    const v = readEnv(name);
    if (v) {
      explicitBase = v;
      break;
    }
  }

  const baseUrl = explicitBase ? normalizeBaseUrl(explicitBase) : provider.baseUrl;
  const model = readEnv('AI_MODEL') || provider.model;
  return { apiKey, baseUrl, model, keyVar };
}

export function getAiCredentials(): AiCredentials {
  return resolveCredentials();
}

export function getAiEnvConfig(): AiEnvConfig {
  const creds = resolveCredentials();
  const maxInputCharsRaw = Number(readEnv('AI_MAX_INPUT_CHARS') || '12000');
  const maxInputChars =
    Number.isFinite(maxInputCharsRaw) && maxInputCharsRaw >= 1000
      ? Math.min(Math.floor(maxInputCharsRaw), 100_000)
      : 12_000;
  return {
    configured: creds.apiKey.length > 0 && creds.baseUrl.length > 0,
    baseUrl: creds.baseUrl,
    model: creds.model,
    maxInputChars,
    keyVar: creds.keyVar,
  };
}

/** Which accepted variable names are present? (names + booleans only). */
export function getAiEnvDiagnostics(): {
  configured: boolean;
  keyVar: string;
  baseUrl: string;
  model: string;
  keyVarsPresent: Record<string, boolean>;
  baseUrlVarsPresent: Record<string, boolean>;
  modelVarPresent: boolean;
} {
  const creds = resolveCredentials();
  const keyVarsPresent: Record<string, boolean> = {};
  for (const name of AI_KEY_VARS) keyVarsPresent[name] = readEnv(name).length > 0;
  const baseUrlVarsPresent: Record<string, boolean> = {};
  for (const name of AI_BASE_URL_VARS) baseUrlVarsPresent[name] = readEnv(name).length > 0;
  return {
    configured: creds.apiKey.length > 0 && creds.baseUrl.length > 0,
    keyVar: creds.keyVar,
    baseUrl: creds.baseUrl,
    model: creds.model,
    keyVarsPresent,
    baseUrlVarsPresent,
    modelVarPresent: readEnv('AI_MODEL').length > 0,
  };
}

/** Setup guidance shown to ADMINS when secrets are missing — no site crash. */
export const AI_SETUP_HINT_AR =
  'لم يتم التعرف على مفتاح الذكاء الاصطناعي بعد. الحلول الأكثر شيوعًا: (1) أضف المتغير بالاسم الدقيق AI_API_KEY في Cloudflare Pages ← Settings ← Environment variables (الاسموليات المدعومة أيضًا: OPENAI_API_KEY و ZAI_API_KEY و OPENROUTER_API_KEY و GROQ_API_KEY). (2) إن كنت تستخدم مزودًا غير OpenAI فأضف AI_API_BASE_URL (مثل https://api.z.ai/api/paas/v4) و AI_MODEL. (3) أي تغيير على متغيرات البيئة يتطلب إعادة نشر جديدة حتى تظهر للدوال.';

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
  /** Env var name the base URL came from ('' when inferred from the provider). */
  baseUrlVar: string;
  /** Raw stored base-URL value (trimmed, pre-normalization) — not a secret. */
  rawBaseUrl: string;
};

/** Accepted key variable names, in priority order. */
export const AI_KEY_VARS = [
  'AI_API_KEY',
  'OPENAI_API_KEY',
  'ZAI_API_KEY',
  'Z_AI_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
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
  GEMINI_API_KEY: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  GOOGLE_API_KEY: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  OPENROUTER_API_KEY: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  GROQ_API_KEY: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
};

function readEnv(name: string): string {
  return (process.env as Record<string, string | undefined>)[name]?.trim() ?? '';
}

/**
 * Strip copy-paste artifacts and repair the most common provider mistakes:
 *  - trailing slashes and a trailing `/chat/completions` (the client appends
 *    the endpoint path itself);
 *  - a missing scheme (copied from docs without https://) → default https;
 *  - Google Gemini: ONLY `<host>/v1beta/openai` speaks the OpenAI protocol —
 *    a bare host or /v1beta (the native generateContent API) would 404.
 */
export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  if (url.toLowerCase().endsWith('/chat/completions')) url = url.slice(0, -'/chat/completions'.length).replace(/\/+$/, '');
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (/^https:\/\/generativelanguage\.googleapis\.com/i.test(url)) {
    // strip a trailing version path WITH or WITHOUT the /openai suffix, then
    // rebuild the exact OpenAI-compat root (idempotent for correct inputs).
    url = url.replace(/\/(v1alpha|v1beta|v1)(\/openai)?\/?$/i, '');
    url = url.replace(/\/openai\/?$/i, '');
    url = `${url}/v1beta/openai`;
  }
  return url.replace(/\/+$/, '');
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
  let baseUrlVar = '';
  for (const name of AI_BASE_URL_VARS) {
    const v = readEnv(name);
    if (v) {
      explicitBase = v;
      baseUrlVar = name;
      break;
    }
  }

  const baseUrl = explicitBase ? normalizeBaseUrl(explicitBase) : provider.baseUrl;
  const model = readEnv('AI_MODEL') || provider.model;
  return { apiKey, baseUrl, model, keyVar, baseUrlVar, rawBaseUrl: explicitBase };
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
  /** Exact URL the client will POST to (diagnostics display only). */
  chatEndpoint: string;
  baseUrlVar: string;
  /** Raw stored value before normalization (catches typos/stray characters). */
  rawBaseUrl: string;
  model: string;
  keyVarsPresent: Record<string, boolean>;
  baseUrlVarsPresent: Record<string, boolean>;
  modelVarPresent: boolean;
  /** Deployed commit SHA (inlined at build time; '' outside Cloudflare). */
  deploySha: string;
} {
  const creds = resolveCredentials();
  const keyVarsPresent: Record<string, boolean> = {};
  for (const name of AI_KEY_VARS) keyVarsPresent[name] = readEnv(name).length > 0;
  const baseUrlVarsPresent: Record<string, boolean> = {};
  for (const name of AI_BASE_URL_VARS) baseUrlVarsPresent[name] = readEnv(name).length > 0;
  const deploySha = (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_DEPLOY_SHA']?.trim() ?? '';
  return {
    configured: creds.apiKey.length > 0 && creds.baseUrl.length > 0,
    keyVar: creds.keyVar,
    baseUrl: creds.baseUrl,
    chatEndpoint: `${creds.baseUrl}/chat/completions`,
    baseUrlVar: creds.baseUrlVar,
    rawBaseUrl: creds.rawBaseUrl,
    model: creds.model,
    keyVarsPresent,
    baseUrlVarsPresent,
    modelVarPresent: readEnv('AI_MODEL').length > 0,
    deploySha,
  };
}

/** Setup guidance shown to ADMINS when secrets are missing — no site crash. */
export const AI_SETUP_HINT_AR =
  'لم يتم التعرف على مفتاح الذكاء الاصطناعي بعد. الحلول الأكثر شيوعًا: (1) أضف المتغير بالاسم الدقيق AI_API_KEY في Cloudflare Pages ← Settings ← Environment variables (الأسماء المدعومة أيضًا: OPENAI_API_KEY و GEMINI_API_KEY و ZAI_API_KEY و OPENROUTER_API_KEY و GROQ_API_KEY). (2) إن كنت تستخدم مزودًا غير OpenAI فأضف AI_API_BASE_URL — لمزود Google Gemini العنوان الصحيح: https://generativelanguage.googleapis.com/v1beta/openai — و AI_MODEL (مثل gemini-2.5-flash). (3) أي تغيير على متغيرات البيئة يتطلب إعادة نشر جديدة حتى تظهر للدوال.';

/**
 * AI environment configuration — SERVER ONLY.
 *
 * The API key lives exclusively in Cloudflare Pages environment variables
 * (AI_API_KEY / AI_API_BASE_URL / AI_MODEL). It is NEVER imported into a
 * client component, NEVER returned from an action, NEVER logged. Every AI
 * request from the platform goes through lib/ai/service.ts on the server.
 */

export type AiEnvConfig = {
  /** True when AI_API_KEY + AI_API_BASE_URL (+ model) are present. */
  configured: boolean;
  /** OpenAI-compatible base URL (includes the version path). */
  baseUrl: string;
  /** Default model id (overridable per-request / by admin settings). */
  model: string;
  /** Hard clamp on user-supplied input characters per request. */
  maxInputChars: number;
};

function readEnv(name: string): string {
  return (process.env as Record<string, string | undefined>)[name]?.trim() ?? '';
}

export function getAiEnvConfig(): AiEnvConfig {
  const baseUrl = readEnv('AI_API_BASE_URL') || 'https://api.openai.com/v1';
  const model = readEnv('AI_MODEL') || 'gpt-4o-mini';
  const maxInputCharsRaw = Number(readEnv('AI_MAX_INPUT_CHARS') || '12000');
  const maxInputChars =
    Number.isFinite(maxInputCharsRaw) && maxInputCharsRaw >= 1000
      ? Math.min(Math.floor(maxInputCharsRaw), 100_000)
      : 12_000;
  const configured = readEnv('AI_API_KEY').length > 0 && baseUrl.length > 0;
  return { configured, baseUrl, model, maxInputChars };
}

/** Setup guidance shown to ADMINS when secrets are missing — no site crash. */
export const AI_SETUP_HINT_AR =
  'لم يتم إعداد مفتاح الذكاء الاصطناعي بعد. أضف المتغيرات التالية في Cloudflare Pages ← Settings ← Environment variables ثم أعد النشر: AI_API_KEY و AI_API_BASE_URL و AI_MODEL. حتى ذلك الحين تظهر ميزات الذكاء الاصطناعي كمتعطلة ولا تُعطّل الموقع.';

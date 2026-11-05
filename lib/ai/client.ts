/**
 * Minimal OpenAI-compatible chat client (fetch-based, edge-runtime safe).
 *
 * Security rules enforced here:
 *  - the API key is read from env at call time and ONLY placed in the
 *    Authorization header — never in error messages, logs or return values;
 *  - failures map to a small error taxonomy with generic Arabic messages;
 *  - a hard timeout + one retry on transient upstream failures (429/5xx).
 *
 * Not every OpenAI-compatible provider is identical: nothing beyond
 * `/chat/completions` with `messages` is assumed. JSON mode is requested
 * defensively (ignored by providers that don't support it).
 */

import { getAiCredentials } from './config';

export type AiErrorCode =
  | 'not_configured'
  | 'timeout'
  | 'rate_limited'
  | 'upstream_error'
  | 'bad_response'
  | 'invalid_input';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatOptions = {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Override the env default model (must still be allow-listed upstream). */
  model?: string;
  timeoutMs?: number;
  /** Ask for a JSON object response (provider-dependent). */
  jsonMode?: boolean;
  /**
   * Number of silent retries on transient failures (429/5xx/network).
   * Default 1. Set 0 for NON-IDEMPOTENT generations (e.g. lesson creation):
   * a retried call can silently produce two completions upstream when the
   * first attempt actually succeeded after the client timed out — to the user
   * this looks like generation "looping around again".
   */
  retries?: number;
};

export type ChatResult =
  | {
      ok: true;
      content: string;
      model: string;
      promptTokens: number;
      completionTokens: number;
      latencyMs: number;
    }
  | {
      ok: false;
      code: AiErrorCode;
      message: string;
      /** Upstream HTTP status (number only — NEVER the response body). */
      httpStatus?: number;
    };

/** 60s default; large non-idempotent generations pass their own longer value. */
const DEFAULT_TIMEOUT_MS = 60_000;

type ProviderChatResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};

export async function aiChat(opts: ChatOptions): Promise<ChatResult> {
  const creds = getAiCredentials();
  if (!creds.apiKey || !creds.baseUrl) {
    return {
      ok: false,
      code: 'not_configured',
      message: 'خدمة الذكاء الاصطناعي غير مُعدة على المنصة بعد — تواصل مع الإدارة.',
    };
  }
  if (!Array.isArray(opts.messages) || opts.messages.length === 0) {
    return { ok: false, code: 'invalid_input', message: 'طلب غير صالح' };
  }
  const model = opts.model?.trim() || creds.model;
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = Math.max(0, Math.min(opts.retries ?? 1, 3));

  let lastCode: AiErrorCode = 'upstream_error';
  let lastMessage = 'تعذر تنفيذ الطلب — أعد المحاولة بعد لحظات';
  let lastStatus: number | undefined = undefined;

  // Retries on transient failures (429 / 5xx / network), small backoff.
  // The caller decides how many — non-idempotent features should pass 0.
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 700));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${creds.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${creds.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? 1200,
          ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        cache: 'no-store',
        signal: controller.signal,
      });
      if (res.status === 429) {
        lastCode = 'rate_limited';
        lastStatus = 429;
        lastMessage = 'الخدمة مشغولة حاليًا بسبب الضغط — أعد المحاولة بعد نصف دقيقة';
        continue;
      }
      if (res.status >= 500) {
        lastCode = 'upstream_error';
        lastStatus = res.status;
        lastMessage = 'خدمة الذكاء الاصطناعي غير متاحة مؤقتًا — أعد المحاولة بعد لحظات';
        continue;
      }
      if (!res.ok) {
        // 4xx: do not retry; keep the message generic (never echo the body —
        // provider error bodies can echo headers/auth details).
        lastStatus = res.status;
        lastCode = res.status === 401 || res.status === 403 ? 'not_configured' : 'bad_response';
        lastMessage =
          res.status === 401 || res.status === 403
            ? 'إعدادات مفتاح الذكاء الاصطناعي غير صالحة — تحتاج مراجعة من الإدارة'
            : 'تعذر تنفيذ الطلب — تحقق من صيغة المدخلات أو أعد المحاولة';
        break;
      }
      const json = (await res.json().catch(() => null)) as ProviderChatResponse | null;
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        lastCode = 'bad_response';
        lastMessage = 'رد غير متوقع من خدمة الذكاء الاصطناعي — أعد المحاولة';
        break;
      }
      return {
        ok: true,
        content: content.trim(),
        model,
        promptTokens: Math.max(0, Number(json?.usage?.prompt_tokens ?? 0) || 0),
        completionTokens: Math.max(0, Number(json?.usage?.completion_tokens ?? 0) || 0),
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        lastCode = 'timeout';
        lastMessage = 'استغرق الطلب وقتًا أطول من المسموح — أعد المحاولة';
      } else {
        lastCode = 'upstream_error';
        lastMessage = 'تعذر الاتصال بخدمة الذكاء الاصطناعي — أعد المحاولة';
      }
    } finally {
      clearTimeout(timer);
    }
  }
  return lastStatus !== undefined
    ? { ok: false, code: lastCode, message: lastMessage, httpStatus: lastStatus }
    : { ok: false, code: lastCode, message: lastMessage };
}

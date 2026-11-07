/**
 * AI model catalog helpers — SERVER ONLY, no secrets in outputs.
 *
 * The admin model picker needs two things:
 *  1. a way to LIST the models the configured provider/key actually offers
 *     (GET <baseUrl>/models — OpenAI-compatible; Gemini's /v1beta/openai
 *     layer implements it too) so the admin never has to guess a name and
 *     hit a 404;
 *  2. strict validation of manually typed model ids.
 *
 * Workers safety: the fetch init here must NEVER carry a `cache` field —
 * the Cloudflare runtime throws on it (see lib/ai/client.ts).
 */

export type ProviderModelsResult =
  | { ok: true; json: unknown }
  | { ok: false; httpStatus?: number; timeout?: boolean };

/**
 * Strict-but-permissive model id check. Provider ids are ASCII identifiers
 * that may contain letters, digits, dots, dashes, underscores, slashes
 * (openai/gpt-4o-mini), colons (llama-3.3-70b-versatile:free) and plus signs.
 * Anything else (spaces, Arabic characters, control chars) is rejected.
 */
export function isValidModelName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/:@+-]{0,119}$/.test(name);
}

/**
 * Extract model ids from the provider's list response. Tolerates:
 *  - OpenAI shape:            { data: [{ id: "gpt-4o-mini" }, ...] }
 *  - Gemini OpenAI-compat:    ids like "models/gemini-2.5-flash" → stripped
 *                             to "gemini-2.5-flash" (the chat API's name);
 *  - Gemini native shape:     { models: [{ name: "models/gemini-2.5-flash" }] }.
 * Returns a sorted, de-duplicated list of plain ids ([] when unrecognized).
 */
export function parseModelsList(json: unknown): string[] {
  const raw: unknown[] = Array.isArray(json)
    ? json
    : json !== null && typeof json === 'object' && Array.isArray((json as Record<string, unknown>)['data'])
      ? ((json as Record<string, unknown>)['data'] as unknown[])
      : json !== null && typeof json === 'object' && Array.isArray((json as Record<string, unknown>)['models'])
        ? ((json as Record<string, unknown>)['models'] as unknown[])
        : [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const candidate = typeof rec['id'] === 'string' ? rec['id'] : typeof rec['name'] === 'string' ? rec['name'] : '';
    let id = candidate.trim();
    if (!id) continue;
    if (id.startsWith('models/')) id = id.slice('models/'.length);
    if (isValidModelName(id)) ids.add(id);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

/** GET <baseUrl>/models with the provider key. 15s hard timeout. */
export async function fetchProviderModels(
  baseUrl: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<ProviderModelsResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetchImpl(`${baseUrl}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, httpStatus: res.status };
    const json: unknown = await res.json().catch(() => null);
    return { ok: true, json };
  } catch (e) {
    const isAbort = e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError');
    return { ok: false, timeout: isAbort };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Central AI gate for the whole platform — SERVER ONLY.
 *
 * Every   AI call from any feature funnels through runAiFeature(), which:
 *  1. refuses when Cloudflare secrets are missing (clear admin hint, no crash);
 *  2. honours the admin toggle + per-feature allow-list (ai_settings table);
 *  3. enforces per-user daily / monthly quotas and per-minute burst limits;
 *  4. clamps input size;
 *  5. logs consumption to ai_usage_logs via the SERVICE ROLE (users can never
 *     forge usage rows, and can only ever read their own).
 *
 * Secrets never pass through this module's inputs or outputs.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getAiEnvConfig, AI_SETUP_HINT_AR } from './config';
import { aiChat, type AiErrorCode } from './client';
import { enforceRate } from '@/lib/rate-limit';

export type AiFeature = 'report_assistant' | 'lesson_generator';

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  report_assistant: 'مساعد كتابة التقارير',
  lesson_generator: 'مولّد الدروس التعليمية',
};

export type AiSettingsRow = {
  enabled: boolean;
  daily_limit_per_user: number;
  per_minute_limit: number;
  monthly_budget_requests: number;
  allowed_features: string[];
  allowed_models: string[];
  default_model: string | null;
};

export type AiRunResult =
  | { ok: true; content: string; model: string; remainingToday: number }
  | {
      ok: false;
      code: AiErrorCode | 'disabled' | 'feature_disabled' | 'quota_exceeded';
      message: string;
      /** True when the failure is "secrets not configured" (admin action needed). */
      setupHint?: boolean;
    };

const DEFAULTS: AiSettingsRow = {
  enabled: true,
  daily_limit_per_user: 25,
  per_minute_limit: 6,
  monthly_budget_requests: 20_000,
  allowed_features: ['report_assistant', 'lesson_generator'],
  allowed_models: [],
  default_model: null,
};

function utcDayStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function utcMonthStart(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function readSettings(): Promise<AiSettingsRow> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('ai_settings').select('*').eq('id', 1).maybeSingle();
    if (!data) return DEFAULTS;
    const row = data as Record<string, unknown>;
    return {
      enabled: row['enabled'] !== false,
      daily_limit_per_user: Number(row['daily_limit_per_user']) || DEFAULTS.daily_limit_per_user,
      per_minute_limit: Number(row['per_minute_limit']) || DEFAULTS.per_minute_limit,
      monthly_budget_requests: Number(row['monthly_budget_requests']) || DEFAULTS.monthly_budget_requests,
      allowed_features: Array.isArray(row['allowed_features'])
        ? (row['allowed_features'] as string[])
        : DEFAULTS.allowed_features,
      allowed_models: Array.isArray(row['allowed_models']) ? (row['allowed_models'] as string[]) : [],
      default_model: typeof row['default_model'] === 'string' && row['default_model'].trim() ? row['default_model'].trim() : null,
    };
  } catch {
    // Table missing (migration not run yet) → behave like a working default
    // config; aiChat itself still fails closed when env secrets are absent.
    return DEFAULTS;
  }
}

export async function countUsage(userId: string): Promise<{ today: number; month: number }> {
  const admin = createAdminClient();
  const dayStart = utcDayStart();
  const monthStart = utcMonthStart();
  const [dayRes, monthRes] = await Promise.all([
    admin
      .from('ai_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayStart),
    admin
      .from('ai_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', monthStart),
  ]);
  return { today: dayRes.count ?? 0, month: monthRes.count ?? 0 };
}

/** UI-facing status (no secrets): is AI usable for this user right now? */
export async function getAiStatusForUser(
  userId: string,
  feature: AiFeature
): Promise<{
  configured: boolean;
  enabled: boolean;
  featureAllowed: boolean;
  usedToday: number;
  limitToday: number;
  remainingToday: number;
  setupHint?: string;
}> {
  const env = getAiEnvConfig();
  const settings = await readSettings();
  const featureAllowed = env.configured && settings.enabled && settings.allowed_features.includes(feature);
  let usedToday = 0;
  if (env.configured && featureAllowed) {
    try {
      usedToday = (await countUsage(userId)).today;
    } catch {
      usedToday = 0;
    }
  }
  const limitToday = settings.daily_limit_per_user;
  return {
    configured: env.configured,
    enabled: settings.enabled,
    featureAllowed,
    usedToday,
    limitToday,
    remainingToday: Math.max(0, limitToday - usedToday),
    setupHint: env.configured ? undefined : AI_SETUP_HINT_AR,
  };
}

export type AiRunParams = {
  userId: string;
  feature: AiFeature;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  /**
   * Wall-clock timeout for the upstream completion. Default 60s; large
   * structured generations (lesson drafts) should pass a longer value.
   */
  timeoutMs?: number;
  /**
   * Silent transient-failure retries inside the AI client. Default 1.
   * Non-idempotent generations (lesson creation) must pass 0 — a retry can
   * produce a second completed generation upstream after the first attempt
   * already succeeded, which the user experiences as duplicate/looping output.
   */
  retries?: number;
};

/**
 * The model that will ACTUALLY be used for the next AI call, and where it
 * came from: the admin's saved choice (ai_settings.default_model) when set
 * and permitted by the allow-list, otherwise the environment default.
 * Single source of truth — runAiFeature, the diagnostics test and the admin
 * UI all resolve through this.
 */
export async function resolveEffectiveAiModel(): Promise<{ model: string; source: 'admin' | 'env' }> {
  const env = getAiEnvConfig();
  const settings = await readSettings();
  if (
    settings.default_model &&
    (settings.allowed_models.length === 0 || settings.allowed_models.includes(settings.default_model))
  ) {
    return { model: settings.default_model, source: 'admin' };
  }
  return { model: env.model, source: 'env' };
}

/** Run one gated, quota-checked, logged AI request. */
export async function runAiFeature(params: AiRunParams): Promise<AiRunResult> {
  const env = getAiEnvConfig();
  if (!env.configured) {
    return { ok: false, code: 'not_configured', message: AI_SETUP_HINT_AR, setupHint: true };
  }
  const settings = await readSettings();
  if (!settings.enabled) {
    return { ok: false, code: 'disabled', message: 'ميزات الذكاء الاصطناعي معطّلة حاليًا من إدارة المنصة.' };
  }
  if (!settings.allowed_features.includes(params.feature)) {
    return { ok: false, code: 'feature_disabled', message: 'هذه الميزة غير مفعّلة ضمن ميزات الذكاء الاصطناعي حاليًا.' };
  }

  // Burst protection (per-instance; the DB quotas below are the hard bound).
  try {
    enforceRate(`ai:${params.userId}`, settings.per_minute_limit, 60_000);
  } catch {
    return {
      ok: false,
      code: 'rate_limited',
      message: `تجاوزت حد الطلبات السريعة (${settings.per_minute_limit}/دقيقة) — انتظر قليلًا ثم أعد المحاولة.`,
    };
  }

  // Daily + monthly quotas (authoritative, from the usage log).
  try {
    const usage = await countUsage(params.userId);
    if (usage.today >= settings.daily_limit_per_user) {
      return {
        ok: false,
        code: 'quota_exceeded',
        message: `وصلت الحد اليومي لاستخدام الذكاء الاصطناعي (${settings.daily_limit_per_user} طلب) — حاول مجددًا غدًا.`,
      };
    }
    if (usage.month >= settings.monthly_budget_requests) {
      return {
        ok: false,
        code: 'quota_exceeded',
        message: 'تم استهلاك ميزانية الطلبات الشهرية للمنصة — تُستأنف الخدمة بداية الشهر القادم.',
      };
    }
  } catch {
    // Quota check infrastructure failure → fail closed rather than drain budget.
    return { ok: false, code: 'upstream_error', message: 'تعذر التحقق من حصة الاستخدام — أعد المحاولة.' };
  }

  // Input clamps.
  const sys = params.systemPrompt.slice(0, 8000);
  const user = params.userPrompt.slice(0, env.maxInputChars);

  // Model resolution: the admin's saved choice wins when the allow-list
  // permits it; otherwise the env default (resolveEffectiveAiModel).
  const model = (await resolveEffectiveAiModel()).model;

  const chat = await aiChat({
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    maxTokens: params.maxTokens,
    temperature: params.temperature,
    jsonMode: params.jsonMode,
    retries: params.retries,
    timeoutMs: params.timeoutMs,
    model,
  });

  // Consumption logging — server-side only. A logging failure must never
  // erase a successful generation, but it IS observable (server log).
  try {
    const admin = createAdminClient();
    await admin.from('ai_usage_logs').insert({
      user_id: params.userId,
      feature: params.feature,
      model: chat.ok ? chat.model : model,
      ok: chat.ok,
      error_code: chat.ok ? null : chat.code,
      prompt_tokens: chat.ok ? chat.promptTokens : 0,
      completion_tokens: chat.ok ? chat.completionTokens : 0,
      latency_ms: chat.ok ? chat.latencyMs : null,
    });
  } catch (logErr) {
    console.error('[ai] usage log write failed:', logErr instanceof Error ? logErr.message : logErr);
  }

  if (!chat.ok) {
    return { ok: false, code: chat.code, message: chat.message };
  }
  const used = await countUsage(params.userId).catch(() => ({ today: 0, month: 0 }));
  return {
    ok: true,
    content: chat.content,
    model: chat.model,
    remainingToday: Math.max(0, settings.daily_limit_per_user - (used.today + 1)),
  };
}

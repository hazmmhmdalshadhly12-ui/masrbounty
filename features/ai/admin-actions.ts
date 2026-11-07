'use server';

/**
 * Admin AI settings update (single row). Admin-only (DB policy also enforces),
 * zod-validated, audit-logged. Secrets are NEVER part of this table — they
 * live in Cloudflare Pages environment variables only.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/admin-actions';
import { logAudit } from '@/services/audit';

const settingsSchema = z.object({
  enabled: z.boolean(),
  daily_limit_per_user: z.coerce.number().int().min(1).max(1000),
  per_minute_limit: z.coerce.number().int().min(1).max(120),
  monthly_budget_requests: z.coerce.number().int().min(1).max(10_000_000),
  allowed_features: z.array(z.enum(['report_assistant', 'lesson_generator'])),
  // NOTE: default_model is intentionally NOT part of this schema — the model
  // choice is owned exclusively by aiSetDefaultModelAction (model picker
  // card), so a settings save can never clobber the admin's model selection.
});

export type AiSettingsUpdate = z.input<typeof settingsSchema>;

export async function updateAiSettingsAction(input: AiSettingsUpdate): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireStaff(['admin']);
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };
    const { error } = await supabase.from('ai_settings').update(parsed.data).eq('id', 1);
    if (error) return { ok: false, error: 'فشل الحفظ: ' + error.message };
    await logAudit('update', 'ai_settings', undefined, { ...parsed.data }, user.id);
    revalidatePath('/admin/ai');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

/**
 * Admin AI diagnostics — WHY is generation failing in production?
 *
 * Answers the three most common causes without ever exposing the key:
 *  1. env var name mismatch — shows which ACCEPTED names are visible to the
 *     server (booleans only, values never leave the server);
 *  2. no redeploy after adding vars — the hint text says so;
 *  3. wrong base URL / model for the provider — the live test reports the
 *     upstream HTTP status (401/404/429/5xx/timeout) with an Arabic
 *     interpretation. Response bodies are never echoed.
 */
import { getAiEnvDiagnostics, getAiEnvConfig, normalizeBaseUrl, getAiCredentials } from '@/lib/ai/config';
import { aiChat } from '@/lib/ai/client';
import { resolveEffectiveAiModel } from '@/lib/ai/service';
import { fetchProviderModels, parseModelsList, isValidModelName } from '@/lib/ai/models';

export type AiDiagnosticsResult = {
  ok: boolean;
  error?: string;
  env: ReturnType<typeof getAiEnvDiagnostics>;
  /** The model the next real AI call would use + where it came from. */
  activeModel: string;
  modelSource: 'admin' | 'env';
  test?: {
    ok: boolean;
    code?: string;
    httpStatus?: number;
    /** Low-level network detail (invalid URL / DNS) — never contains the key. */
    detail?: string;
    /** Exact URL the test POSTed to (admin display only, not a secret). */
    targetUrl: string;
    latencyMs: number;
    model: string;
    interpretation: string;
  };
};

function interpretFailure(
  code: string | undefined,
  httpStatus: number | undefined,
  keyVar: string,
  detail?: string
): string {
  if (code === 'not_configured' && !keyVar) {
    return 'الخادم لا يرى أي متغير مفتاح من الأسماء المدعومة (AI_API_KEY أو OPENAI_API_KEY أو GEMINI_API_KEY...). أضف المفتاح بأحد هذه الأسماء ثم أعد النشر.';
  }
  if (httpStatus === 401 || httpStatus === 403 || code === 'not_configured') {
    return 'المزود رفض المفتاح (' + (httpStatus ?? 401) + '). المفتاح غير صالح، أو منسوخ من مزود مختلف عن AI_API_BASE_URL الحالي.';
  }
  if (httpStatus === 404) {
    return 'المسار أو النموذج غير موجود (404). غالبًا اسم النموذج لا يوفره مفتاحك — استخدم بطاقة «اختيار نموذج الذكاء الاصطناعي» في هذه الصفحة: اضغط «جلب النماذج المتاحة» واختر نموذجًا من القائمة الفعلية لمفتاحك. إن بقي 404 بعد اختيار نموذج من القائمة فتحقق أن AI_API_BASE_URL هو جذر التوافق مع OpenAI (لمزود Google Gemini: https://generativelanguage.googleapis.com/v1beta/openai).';
  }
  if (httpStatus === 400) {
    return 'الطلب مرفوض (400) — غالبًا اسم النموذج لا يناسب هذا المزود. صحّح AI_MODEL أو النموذج الافتراضي من هذه الصفحة.';
  }
  if (httpStatus === 429 || code === 'rate_limited') {
    return 'المزود حدّد معدل الطلبات (429). المفتاح يعمل — راقب الحصة أو خفّف الاستخدام.';
  }
  if (code === 'timeout') {
    return 'استغرق الطلب أكثر من 25 ثانية (انتهاء مهلة). المزود بطيء أو يوجد حجب شبكي على المسار.';
  }
  if (code === 'upstream_error' && httpStatus && httpStatus >= 500) {
    return 'المزود رجع خطأ خادم (HTTP ' + httpStatus + ') — مشكلة مؤقتة لدى المزود نفسه. أعد المحاولة بعد دقائق.';
  }
  if (code === 'upstream_error') {
    const tech = detail ? ' السبب التقني: ' + detail : '';
    return (
      'فشل الاتصال الشبكي بالمزود قبل وصول أي رد — غالبًا قيمة AI_API_BASE_URL غير صالحة (فراغ أو خطأ إملائي في النطاق) أو النطاق غير موجود.' +
      tech +
      ' راجع «القيمة المخزنة» و«الرابط المستهدف» في الأعلى وقارنهما.'
    );
  }
  return 'فشل غير معروف من المزود' + (httpStatus ? ' (HTTP ' + httpStatus + ')' : '') + ' — أعد المحاولة وراقب سجل الطلبات بالأسفل.';
}

export async function aiDiagnosticsAction(runTest: boolean): Promise<AiDiagnosticsResult> {
  try {
    await requireStaff(['admin', 'moderator']);
    const diag = getAiEnvDiagnostics();
    const effective = await resolveEffectiveAiModel();
    const result: AiDiagnosticsResult = { ok: true, env: diag, activeModel: effective.model, modelSource: effective.source };
    if (runTest) {
      const env = getAiEnvConfig();
      const targetUrl = `${diag.baseUrl}/chat/completions`;
      // Pre-validate so a malformed stored URL produces a precise message
      // instead of an opaque network failure.
      try {
        new URL(normalizeBaseUrl(targetUrl));
      } catch {
        return {
          ...result,
          test: {
            ok: false,
            code: 'upstream_error',
            targetUrl,
            latencyMs: 0,
            model: effective.model,
            interpretation:
              'قيمة AI_API_BASE_URL المخزنة في Cloudflare لا تشكّل رابطًا صالحًا («الرابط المستهدف» بالأعلى). صحّح القيمة — يجب أن تبدأ بـ https:// وبدون فراغات — ثم أعد النشر.',
          },
        };
      }
      const chat = await aiChat({
        messages: [{ role: 'user', content: 'ping — reply with the single word: pong' }],
        maxTokens: 16,
        temperature: 0,
        timeoutMs: 25_000,
        retries: 0,
        // Test the model that real features will actually use (the admin's
        // saved choice when set), not just the env default.
        model: effective.model,
      });
      result.test = chat.ok
        ? {
            ok: true,
            targetUrl,
            latencyMs: chat.latencyMs,
            model: chat.model,
            interpretation: 'الاتصال بخدمة الذكاء الاصطناعي يعمل — جرب التوليد الآن.',
          }
        : {
            ok: false,
            code: chat.code,
            httpStatus: chat.httpStatus,
            detail: chat.detail,
            targetUrl,
            latencyMs: 0,
            model: effective.model,
            interpretation: interpretFailure(chat.code, chat.httpStatus, diag.keyVar, chat.detail),
          };
    }
    return result;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'خطأ غير متوقع',
      env: getAiEnvDiagnostics(),
      activeModel: '',
      modelSource: 'env',
    };
  }
}

/**
 * Admin model picker — list the models the configured provider/key actually
 * offers (GET <baseUrl>/models, OpenAI-compatible). Lets the admin pick a
 * VALID model instead of guessing a name and hitting a 404. Returns plain
 * model ids only — never the key, never raw provider error bodies.
 */
export type AiModelsListResult =
  | { ok: true; models: string[]; activeModel: string; modelSource: 'admin' | 'env' }
  | { ok: false; error: string };

export async function aiListModelsAction(): Promise<AiModelsListResult> {
  try {
    await requireStaff(['admin', 'moderator']);
    const creds = getAiCredentials();
    if (!creds.apiKey || !creds.baseUrl) {
      return { ok: false, error: 'خدمة الذكاء الاصطناعي غير مُعدة بعد — أضف المفتاح في Cloudflare Pages أولاً.' };
    }
    const res = await fetchProviderModels(creds.baseUrl, creds.apiKey);
    if (res.ok) {
      const models = parseModelsList(res.json);
      if (models.length === 0) {
        return { ok: false, error: 'رجع المزود قائمة فارغة أو غير مفهومة — اكتب اسم النموذج يدويًا في الحقل بالأسفل.' };
      }
      const effective = await resolveEffectiveAiModel();
      return { ok: true, models, activeModel: effective.model, modelSource: effective.source };
    }
    if (res.timeout) {
      return { ok: false, error: 'انتهت مهلة جلب قائمة النماذج من المزود — أعد المحاولة، أو اكتب الاسم يدويًا.' };
    }
    if (res.httpStatus === 401 || res.httpStatus === 403) {
      return { ok: false, error: `المزود رفض المفتاح عند جلب القائمة (HTTP ${res.httpStatus}) — راجع صلاحية المفتاح.` };
    }
    if (res.httpStatus === 404) {
      return { ok: false, error: 'هذا المزود لا يدعم جلب قائمة النماذج — اكتب اسم النموذج يدويًا في الحقل بالأسفل.' };
    }
    if (res.httpStatus === 429) {
      return { ok: false, error: 'المزود مشغول حاليًا (429) — أعد المحاولة بعد نصف دقيقة.' };
    }
    return {
      ok: false,
      error: `تعذر جلب القائمة من المزود${res.httpStatus ? ` (HTTP ${res.httpStatus})` : ''} — اكتب اسم النموذج يدويًا في الحقل بالأسفل.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

/**
 * Save the admin's model choice (ai_settings.default_model, single row).
 * Pass null/empty to clear it and fall back to the environment default.
 * Takes effect on the NEXT AI call — no redeploy needed (unlike env vars).
 */
export async function aiSetDefaultModelAction(model: string | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireStaff(['admin']);
    const trimmed = (model ?? '').trim();
    if (trimmed && !isValidModelName(trimmed)) {
      return {
        ok: false,
        error: 'اسم النموذج غير صالح — استخدم أحرفًا إنجليزية وأرقامًا و . _ / : @ + - فقط (حتى 120 حرفًا).',
      };
    }
    const value = trimmed || null;
    const { error } = await supabase.from('ai_settings').update({ default_model: value }).eq('id', 1);
    if (error) return { ok: false, error: 'فشل الحفظ: ' + error.message };
    await logAudit('update', 'ai_settings', undefined, { default_model: value }, user.id);
    revalidatePath('/admin/ai');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

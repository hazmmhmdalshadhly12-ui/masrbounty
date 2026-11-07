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
  default_model: z.string().trim().max(120).nullable(),
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
import { getAiEnvDiagnostics, getAiEnvConfig } from '@/lib/ai/config';
import { aiChat } from '@/lib/ai/client';

export type AiDiagnosticsResult = {
  ok: boolean;
  error?: string;
  env: {
    configured: boolean;
    keyVar: string;
    baseUrl: string;
    model: string;
    keyVarsPresent: Record<string, boolean>;
    baseUrlVarsPresent: Record<string, boolean>;
    modelVarPresent: boolean;
  };
  test?: {
    ok: boolean;
    code?: string;
    httpStatus?: number;
    latencyMs: number;
    model: string;
    interpretation: string;
  };
};

function interpretFailure(code: string | undefined, httpStatus: number | undefined, keyVar: string): string {
  if (code === 'not_configured' && !keyVar) {
    return 'الخادم لا يرى أي متغير مفتاح من الأسماء المدعومة (AI_API_KEY أو OPENAI_API_KEY أو ZAI_API_KEY...). أضف المفتاح بأحد هذه الأسماء ثم أعد النشر.';
  }
  if (httpStatus === 401 || httpStatus === 403 || code === 'not_configured') {
    return 'المزود رفض المفتاح (' + (httpStatus ?? 401) + '). المفتاح غير صالح، أو منسوخ من مزود مختلف عن AI_API_BASE_URL الحالي.';
  }
  if (httpStatus === 404) {
    return 'المسار أو النموذج غير موجود (404). تحقق أن AI_API_BASE_URL هو جذر التوافق مع OpenAI (ينتهي بـ /v1 أو ما يقابله) وأن اسم النموذج صحيح لهذا المزود. لمزود Google Gemini العنوان الصحيح: https://generativelanguage.googleapis.com/v1beta/openai (النظام يصححه تلقائيًا الآن).';
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
  if (code === 'upstream_error') {
    return 'تعذر الوصول للمزود نهائيًا. تحقق من صحة AI_API_BASE_URL (مع https://) ومن أن المزود متاح.';
  }
  return 'فشل غير معروف من المزود' + (httpStatus ? ' (HTTP ' + httpStatus + ')' : '') + ' — أعد المحاولة وراقب سجل الطلبات بالأسفل.';
}

export async function aiDiagnosticsAction(runTest: boolean): Promise<AiDiagnosticsResult> {
  try {
    await requireStaff(['admin', 'moderator']);
    const diag = getAiEnvDiagnostics();
    const result: AiDiagnosticsResult = { ok: true, env: diag };
    if (runTest) {
      const env = getAiEnvConfig();
      const chat = await aiChat({
        messages: [{ role: 'user', content: 'ping — reply with the single word: pong' }],
        maxTokens: 16,
        temperature: 0,
        timeoutMs: 25_000,
        retries: 0,
        model: env.model,
      });
      result.test = chat.ok
        ? { ok: true, latencyMs: chat.latencyMs, model: chat.model, interpretation: 'الاتصال بخدمة الذكاء الاصطناعي يعمل — جرب التوليد الآن.' }
        : {
            ok: false,
            code: chat.code,
            httpStatus: chat.httpStatus,
            latencyMs: 0,
            model: env.model,
            interpretation: interpretFailure(chat.code, chat.httpStatus, diag.keyVar),
          };
    }
    return result;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'خطأ غير متوقع',
      env: {
        configured: false,
        keyVar: '',
        baseUrl: '',
        model: '',
        keyVarsPresent: {},
        baseUrlVarsPresent: {},
        modelVarPresent: false,
      },
    };
  }
}

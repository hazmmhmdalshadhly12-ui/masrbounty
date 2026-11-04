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
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' };
    const { error } = await supabase.from('ai_settings').update(parsed.data).eq('id', 1);
    if (error) return { ok: false, error: 'فشل الحفظ: ' + error.message };
    await logAudit('update', 'ai_settings', undefined, { ...parsed.data }, user.id);
    revalidatePath('/admin/ai');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

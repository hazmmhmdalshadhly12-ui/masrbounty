'use server';

/**
 * Admin: reputation adjustments, achievement certificates, levels, report limits.
 * Every action re-verifies the staff role server-side and is audit-logged.
 * Reputation adjustments go through the DB RPC `adjust_reputation` (admin-only,
 * writes the append-only ledger); nobody — admin included — edits rows directly.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/admin-actions';
import { logAudit } from '@/services/audit';

export type ReputationAdminResult = { ok: boolean; error?: string; newScore?: number; certificateNumber?: string };

const adjustSchema = z.object({
  researcherId: z.string().uuid(),
  delta: z.coerce.number().int().refine((v) => v !== 0 && Math.abs(v) <= 500, 'التعديل يجب أن يكون بين -500 و +500 وغير صفري'),
  reason: z.string().trim().min(5, 'سبب التعديل مطلوب (5 أحرف على الأقل)').max(500),
});

export async function adjustReputationAction(
  researcherId: string,
  delta: number,
  reason: string
): Promise<ReputationAdminResult> {
  try {
    const { supabase, user } = await requireStaff(['admin']);
    const parsed = adjustSchema.safeParse({ researcherId, delta, reason });
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' };
    const { data, error } = await supabase.rpc('adjust_reputation', {
      p_researcher: parsed.data.researcherId,
      p_delta: parsed.data.delta,
      p_reason: parsed.data.reason,
    });
    if (error) return { ok: false, error: 'فشل التعديل: ' + error.message };
    void user;
    revalidatePath('/admin/reputation');
    revalidatePath('/leaderboard');
    return { ok: true, newScore: Number(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

const certSchema = z.object({
  userId: z.string().uuid(),
  titleAr: z.string().trim().min(3).max(200),
  titleEn: z.string().trim().max(200).optional().or(z.literal('')),
  reason: z.string().trim().min(10, 'يجب توثيق أساس الإصدار (10 أحرف على الأقل)').max(1000),
});

/** Admin-issued Bug Bounty achievement certificate (audited, reason required). */
export async function issueAchievementCertificateAction(
  userId: string,
  titleAr: string,
  titleEn: string,
  reason: string
): Promise<ReputationAdminResult> {
  try {
    const { supabase } = await requireStaff();
    const parsed = certSchema.safeParse({ userId, titleAr, titleEn, reason });
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' };
    const { data, error } = await supabase.rpc('issue_achievement_certificate', {
      p_user: parsed.data.userId,
      p_title_ar: parsed.data.titleAr,
      p_title_en: parsed.data.titleEn || null,
      p_reason: parsed.data.reason,
    });
    if (error) return { ok: false, error: 'فشل الإصدار: ' + error.message };
    revalidatePath('/admin/reputation');
    return { ok: true, certificateNumber: typeof data === 'string' ? data : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

export async function revokeCertificateAction(
  certificateId: string,
  reason: string
): Promise<ReputationAdminResult> {
  try {
    const { supabase } = await requireStaff();
    const cleanReason = reason.trim();
    if (cleanReason.length < 5) return { ok: false, error: 'سبب الإلغاء مطلوب (5 أحرف على الأقل)' };
    const { error } = await supabase.rpc('revoke_certificate', {
      p_certificate: certificateId,
      p_reason: cleanReason,
    });
    if (error) return { ok: false, error: 'فشل الإلغاء: ' + error.message };
    revalidatePath('/admin/reputation');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

const levelSchema = z.object({
  name_ar: z.string().trim().min(2).max(80),
  name_en: z.string().trim().max(80).optional().or(z.literal('')),
  min_score: z.coerce.number().int().min(0).max(1_000_000),
  min_accepted: z.coerce.number().int().min(0).max(100_000),
  requires_identity_verified: z.boolean(),
  is_active: z.boolean(),
});

export async function updateResearcherLevelAction(
  levelId: string,
  input: { name_ar: string; name_en: string; min_score: number; min_accepted: number; requires_identity_verified: boolean; is_active: boolean }
): Promise<ReputationAdminResult> {
  try {
    const { supabase, user } = await requireStaff(['admin']);
    const parsed = levelSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' };
    const d = parsed.data;
    const { error } = await supabase
      .from('researcher_levels')
      .update({
        name_ar: d.name_ar,
        name_en: d.name_en || null,
        min_score: d.min_score,
        min_accepted: d.min_accepted,
        requires_identity_verified: d.requires_identity_verified,
        is_active: d.is_active,
      })
      .eq('id', levelId);
    if (error) return { ok: false, error: 'فشل التحديث: ' + error.message };
    await logAudit('update', 'researcher_levels', levelId, { ...d }, user.id);
    revalidatePath('/admin/reputation');
    revalidatePath('/leaderboard');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

export type ResearcherSearchRow = {
  researcherId: string;
  userId: string;
  username: string;
  displayName: string;
  score: number;
  levelName: string | null;
  acceptedReports: number;
};

/** Staff-only researcher search (by username / display name). */
export async function searchResearchersForAdminAction(
  q: string
): Promise<{ ok: boolean; rows: ResearcherSearchRow[]; error?: string }> {
  try {
    const { supabase } = await requireStaff();
    const term = q.trim().replace(/[%_]/g, '');
    if (term.length < 2) return { ok: true, rows: [] };
    const like = `%${term}%`;
    const { data: profiles, error } = await supabase
      .from('researcher_profiles')
      .select('id, user_id, display_name, profiles(username, full_name)')
      .or(`display_name.ilike.${like},profiles.username.ilike.${like},profiles.full_name.ilike.${like}`)
      .limit(10);
    if (error) return { ok: false, rows: [], error: error.message };
    const rows = ((profiles ?? []) as unknown as Record<string, unknown>[]);
    if (rows.length === 0) return { ok: true, rows: [] };
    const rids = rows.map((r) => String(r['id']));
    const [{ data: reps }, { data: stats }] = await Promise.all([
      supabase
        .from('researcher_reputation')
        .select('researcher_id, score, level_id, researcher_levels(name_ar)')
        .in('researcher_id', rids),
      supabase.from('researcher_stats').select('researcher_id, accepted_reports').in('researcher_id', rids),
    ]);
    const repMap = new Map(
      ((reps ?? []) as unknown as { researcher_id: string; score: number; researcher_levels: { name_ar: string } | null }[]).map((r) => [
        r.researcher_id,
        r,
      ])
    );
    const statMap = new Map(((stats ?? []) as { researcher_id: string; accepted_reports: number }[]).map((s) => [s.researcher_id, s]));
    const out: ResearcherSearchRow[] = rows.map((r) => {
      const profile = (r['profiles'] ?? {}) as { username?: string; full_name?: string };
      const rep = repMap.get(String(r['id']));
      return {
        researcherId: String(r['id']),
        userId: String(r['user_id'] ?? ''),
        username: String(profile.username ?? '—'),
        displayName: String(r['display_name'] ?? profile.full_name ?? ''),
        score: Number(rep?.score ?? 0),
        levelName: rep?.researcher_levels?.name_ar ?? null,
        acceptedReports: Number(statMap.get(String(r['id']))?.accepted_reports ?? 0),
      };
    });
    return { ok: true, rows: out };
  } catch (e) {
    return { ok: false, rows: [], error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

const limitsSchema = z.object({
  daily_max: z.coerce.number().int().min(0).max(1000),
  hourly_max: z.coerce.number().int().min(0).max(1000),
});

/** Update the platform-wide report limits (platform_settings.report_limits). */
export async function updateReportLimitsAction(
  dailyMax: number,
  hourlyMax: number
): Promise<ReputationAdminResult> {
  try {
    const { supabase, user } = await requireStaff(['admin']);
    const parsed = limitsSchema.safeParse({ daily_max: dailyMax, hourly_max: hourlyMax });
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'قيم غير صالحة' };
    if (parsed.data.hourly_max > parsed.data.daily_max) {
      return { ok: false, error: 'الحد الساعي لا يمكن أن يتجاوز اليومي' };
    }
    const { error } = await supabase
      .from('platform_settings')
      .update({ value: parsed.data, updated_at: new Date().toISOString() })
      .eq('key', 'report_limits');
    if (error) return { ok: false, error: 'فشل التحديث: ' + error.message };
    await logAudit('update', 'platform_settings', undefined, { key: 'report_limits', ...parsed.data }, user.id);
    revalidatePath('/admin/report-limits');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

const overrideSchema = z.object({
  userId: z.string().uuid(),
  daily_limit: z.coerce.number().int().min(0).max(1000).nullable(),
  hourly_limit: z.coerce.number().int().min(0).max(1000).nullable(),
  reason: z.string().trim().max(300).optional().or(z.literal('')),
});

/** Set/clear a per-user report limit override (raise trusted users, restrict abusers). */
export async function setReportLimitOverrideAction(
  userId: string,
  dailyLimit: number | null,
  hourlyLimit: number | null,
  reason: string
): Promise<ReputationAdminResult> {
  try {
    const { supabase, user } = await requireStaff(['admin']);
    const parsed = overrideSchema.safeParse({ userId, daily_limit: dailyLimit, hourly_limit: hourlyLimit, reason });
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'بيانات غير صالحة' };
    const d = parsed.data;
    if (d.daily_limit == null && d.hourly_limit == null) {
      // both null → remove the override entirely
      const { error } = await supabase.from('report_limit_overrides').delete().eq('user_id', d.userId);
      if (error) return { ok: false, error: 'فشل إزالة الاستثناء: ' + error.message };
      await logAudit('delete', 'report_limit_overrides', d.userId, { removed: true }, user.id);
      revalidatePath('/admin/report-limits');
      return { ok: true };
    }
    const { error } = await supabase
      .from('report_limit_overrides')
      .upsert(
        {
          user_id: d.userId,
          daily_limit: d.daily_limit,
          hourly_limit: d.hourly_limit,
          reason: d.reason || null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    if (error) return { ok: false, error: 'فشل الحفظ: ' + error.message };
    await logAudit('update', 'report_limit_overrides', d.userId, { daily: d.daily_limit, hourly: d.hourly_limit }, user.id);
    revalidatePath('/admin/report-limits');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقع' };
  }
}

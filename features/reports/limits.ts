'use server';

/**
 * Daily report limits & anti-abuse — SERVER SIDE.
 *
 * The limit applies to SUBMISSIONS ONLY (submitReportAction): saving a draft
 * or editing an existing report is never blocked. Limits come from
 * platform_settings.report_limits (admin-tunable) with per-user overrides in
 * report_limit_overrides (raise for trusted users, lower for abusers — both
 * admin-only writes). Every exceeded attempt is recorded in suspicious_events.
 */

import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type ReportLimits = {
  dailyMax: number;
  hourlyMax: number;
  /** True when the numbers come from a per-user override. */
  overridden: boolean;
  source: 'platform' | 'override';
};

const PLATFORM_DEFAULTS = { daily_max: 10, hourly_max: 5 };

export async function getEffectiveReportLimits(userId: string): Promise<ReportLimits> {
  let daily = PLATFORM_DEFAULTS.daily_max;
  let hourly = PLATFORM_DEFAULTS.hourly_max;
  let overridden = false;
  try {
    const admin = createAdminClient();
    const [settingsRes, overrideRes] = await Promise.all([
      admin.from('platform_settings').select('value').eq('key', 'report_limits').maybeSingle(),
      admin.from('report_limit_overrides').select('daily_limit, hourly_limit').eq('user_id', userId).maybeSingle(),
    ]);
    const val = (settingsRes.data as { value?: Record<string, unknown> } | null)?.value;
    if (val && typeof val['daily_max'] === 'number') daily = Math.max(0, Number(val['daily_max']));
    if (val && typeof val['hourly_max'] === 'number') hourly = Math.max(0, Number(val['hourly_max']));
    const ov = overrideRes.data as { daily_limit: number | null; hourly_limit: number | null } | null;
    if (ov && (ov.daily_limit != null || ov.hourly_limit != null)) {
      if (ov.daily_limit != null) daily = Math.max(0, Number(ov.daily_limit));
      if (ov.hourly_limit != null) hourly = Math.max(0, Number(ov.hourly_limit));
      overridden = true;
    }
  } catch {
    // settings/overrides unavailable → defaults (safe, non-blocking)
  }
  return { dailyMax: daily, hourlyMax: hourly, overridden, source: overridden ? 'override' : 'platform' };
}

export type LimitCheckResult = { allowed: boolean; reason?: string; limits?: ReportLimits; submittedToday?: number };

/**
 * Check (and later record) submission allowance for a researcher.
 * Counts reports with submitted_at within the window — drafts don't count.
 */
export async function checkReportSubmissionLimit(researcherId: string, userId: string): Promise<LimitCheckResult> {
  const limits = await getEffectiveReportLimits(userId);
  const supabase = await createServerClient();
  const now = Date.now();
  const dayStart = new Date(now - 24 * 3600 * 1000).toISOString();
  const hourStart = new Date(now - 3600 * 1000).toISOString();

  const [{ count: dayCount }, { count: hourCount }] = await Promise.all([
    supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('researcher_id', researcherId)
      .gte('submitted_at', dayStart),
    supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('researcher_id', researcherId)
      .gte('submitted_at', hourStart),
  ]);

  const submittedToday = dayCount ?? 0;
  if ((dayCount ?? 0) >= limits.dailyMax) {
    return {
      allowed: false,
      submittedToday,
      limits,
      reason:
        `وصلت الحد اليومي لإرسال التقارير (${limits.dailyMax}${limits.overridden ? ' — حد خاص بحسابك' : ''}). ` +
        'يمكنك متابعة حفظ المسودات وتعديل تقاريرك، والإرسال يعود متاحًا بعد 24 ساعة من كل إرسال.',
    };
  }
  if ((hourCount ?? 0) >= limits.hourlyMax) {
    return {
      allowed: false,
      submittedToday,
      limits,
      reason:
        `أرسلت ${hourCount} تقارير خلال الساعة الأخيرة (الحد ${limits.hourlyMax}). انتظر قليلًا ثم أعد الإرسال — ` +
        'هذا الحد يمنع الإرسال الآلي المتكرر.',
    };
  }
  return { allowed: true, submittedToday, limits };
}

/** Record an exceeded attempt for admin monitoring (best-effort, server-side). */
export async function recordAbuseAttempt(userId: string, kind: string, detail: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('suspicious_events').insert({
      user_id: userId,
      kind,
      detail: detail.slice(0, 500),
      severity: 'medium',
    });
  } catch (e) {
    console.error('[report-limits] failed to record suspicious event:', e instanceof Error ? e.message : e);
  }
}

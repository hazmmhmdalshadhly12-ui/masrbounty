/**
 * Report limits: effective-limit resolution (platform settings + per-user
 * overrides) and submission gating with abuse recording.
 */
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}));

type AdminOverride = { daily_limit: number | null; hourly_limit: number | null } | null;

function makeAdmin(settingsValue: Record<string, unknown> | null, override: AdminOverride) {
  const { createAdminClient } = require('@/lib/supabase/admin') as { createAdminClient: jest.Mock };
  createAdminClient.mockReturnValue({
    from: (table: string) => {
      if (table === 'platform_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: settingsValue ? { value: settingsValue } : null }),
            }),
          }),
        };
      }
      if (table === 'report_limit_overrides') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: override }) }),
          }),
        };
      }
      if (table === 'suspicious_events') {
        return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
      }
      throw new Error('unexpected table ' + table);
    },
  });
}

function makeServer(dayCount: number, hourCount: number) {
  const { createServerClient } = require('@/lib/supabase/server') as { createServerClient: jest.Mock };
  let reportQueries = 0; // shared across both queries in Promise.all
  createServerClient.mockReturnValue({
    from: (table: string) => {
      if (table === 'reports') {
        return {
          select: (_cols: string, _opts?: unknown) => ({
            eq: () => ({
              gte: async () => {
                reportQueries += 1;
                return { count: reportQueries === 1 ? dayCount : hourCount };
              },
            }),
          }),
        };
      }
      throw new Error('unexpected table ' + table);
    },
  });
}

describe('features/reports/limits', () => {
  const ORIGINAL_ENV = { ...process.env };
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, SUPABASE_SERVICE_ROLE_KEY: 'x' };
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('platform defaults when no settings row and no override', async () => {
    makeAdmin(null, null);
    const { getEffectiveReportLimits } = await import('@/features/reports/limits');
    const l = await getEffectiveReportLimits('user-1');
    expect(l).toEqual({ dailyMax: 10, hourlyMax: 5, overridden: false, source: 'platform' });
  });

  it('platform settings apply when present', async () => {
    makeAdmin({ daily_max: 3, hourly_max: 2 }, null);
    const { getEffectiveReportLimits } = await import('@/features/reports/limits');
    const l = await getEffectiveReportLimits('user-1');
    expect(l.dailyMax).toBe(3);
    expect(l.hourlyMax).toBe(2);
    expect(l.overridden).toBe(false);
  });

  it('per-user override wins and is flagged', async () => {
    makeAdmin({ daily_max: 10, hourly_max: 5 }, { daily_limit: 50, hourly_limit: 20 });
    const { getEffectiveReportLimits } = await import('@/features/reports/limits');
    const l = await getEffectiveReportLimits('user-1');
    expect(l).toEqual({ dailyMax: 50, hourlyMax: 20, overridden: true, source: 'override' });
  });

  it('partial override overrides only the provided field', async () => {
    makeAdmin({ daily_max: 10, hourly_max: 5 }, { daily_limit: null, hourly_limit: 1 });
    const { getEffectiveReportLimits } = await import('@/features/reports/limits');
    const l = await getEffectiveReportLimits('user-1');
    expect(l.dailyMax).toBe(10);
    expect(l.hourlyMax).toBe(1);
    expect(l.overridden).toBe(true);
  });

  it('blocks submission at the daily cap with an explanatory Arabic message', async () => {
    makeAdmin({ daily_max: 2, hourly_max: 2 }, null);
    makeServer(2, 0);
    const { checkReportSubmissionLimit } = await import('@/features/reports/limits');
    const res = await checkReportSubmissionLimit('researcher-1', 'user-1');
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('الحد اليومي');
    expect(res.submittedToday).toBe(2);
  });

  it('blocks at the hourly cap with the anti-automation message', async () => {
    makeAdmin({ daily_max: 10, hourly_max: 2 }, null);
    makeServer(1, 2);
    const { checkReportSubmissionLimit } = await import('@/features/reports/limits');
    const res = await checkReportSubmissionLimit('researcher-1', 'user-1');
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('الساعة الأخيرة');
  });

  it('allows under the caps', async () => {
    makeAdmin({ daily_max: 10, hourly_max: 5 }, null);
    makeServer(3, 1);
    const { checkReportSubmissionLimit } = await import('@/features/reports/limits');
    const res = await checkReportSubmissionLimit('researcher-1', 'user-1');
    expect(res.allowed).toBe(true);
  });
});

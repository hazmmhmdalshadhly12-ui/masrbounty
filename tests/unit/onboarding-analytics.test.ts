import { registerSchema, registerAccountStep, registerCompanyStep } from '@/schemas/auth';
import { MAX_SKILLS, isValidCompanySize, isValidExperienceLevel, parseSkills, researcherOnboardingColumns } from '@/lib/auth/onboarding';
import { ANALYTICS_RANGES, buildRangeWindow, countBy, parseAnalyticsRange, sumNumeric } from '@/lib/analytics/range';

const base = {
  username: 'hunter_eg',
  email: 'hunter@example.com',
  password: 'S3curePass!',
  confirmPassword: 'S3curePass!',
  full_name: 'أحمد علي',
  phone: '01012345678',
  role: 'researcher' as const,
};

describe('register onboarding schema', () => {
  it('researcher payload with onboarding answers parses', () => {
    const out = registerSchema.parse({
      ...base,
      experience_level: 'advanced',
      skills: 'xss, sqli , xss',
      github: 'https://github.com/hunter',
    });
    expect(out.experience_level).toBe('advanced');
    expect(out.skills).toBe('xss, sqli , xss');
    expect(out.github).toBe('https://github.com/hunter');
  });

  it('empty-string answers become undefined (no accidental validation errors)', () => {
    const out = registerSchema.parse({ ...base, experience_level: '', skills: '', github: '' });
    expect(out.experience_level).toBeUndefined();
    expect(out.skills).toBeUndefined();
    expect(out.github).toBeUndefined();
  });

  it('invalid experience level is rejected', () => {
    expect(() => registerSchema.parse({ ...base, experience_level: 'wizard' })).toThrow();
  });

  it('bad github url is rejected', () => {
    expect(() => registerSchema.parse({ ...base, github: 'not-a-url' })).toThrow();
  });

  it('company payload requires company_name (wizard step 2)', () => {
    expect(() => registerSchema.parse({ ...base, role: 'company' })).toThrow();
    const ok = registerSchema.parse({
      ...base,
      role: 'company',
      company_name: 'ماسر باونتي',
      company_website: 'https://masrbounty.online',
      company_size: '11-50',
      company_description: 'منصة مكافآت',
    });
    expect(ok.company_name).toBe('ماسر باونتي');
    expect(ok.company_size).toBe('11-50');
  });

  it('invalid company size rejected', () => {
    expect(() => registerSchema.parse({ ...base, role: 'company', company_name: 'شركة', company_size: 'million' })).toThrow();
  });

  it('step-1 schema validates account fields only (password mismatch caught, missing company name allowed at step 1)', () => {
    expect(() => registerAccountStep.parse({ ...base, confirmPassword: 'Nope12345' })).toThrow();
    const step1 = registerAccountStep.parse({ ...base, role: 'company' });
    expect(step1.role).toBe('company');
  });

  it('step-2 company schema validates its own fields', () => {
    const ok = registerCompanyStep.parse({ company_name: 'شركة الأمن', company_website: '', company_size: '', company_description: '' });
    expect(ok.company_name).toBe('شركة الأمن');
    expect(ok.company_website).toBeUndefined();
  });
});

describe('parseSkills', () => {
  it('trims, drops empties and de-duplicates case-insensitively', () => {
    expect(parseSkills(' XSS ,, sqli ,Xss\n IDOR ')).toEqual(['XSS', 'sqli', 'IDOR']);
  });
  it('supports arabic comma and caps at MAX_SKILLS', () => {
    const raw = Array.from({ length: 30 }, (_, i) => `skill${i}`).join('،');
    const out = parseSkills(raw);
    expect(out).toHaveLength(MAX_SKILLS);
  });
  it('caps individual skill length', () => {
    const out = parseSkills('x'.repeat(100));
    expect(out[0]).toHaveLength(40);
  });
  it('empty input -> empty array', () => {
    expect(parseSkills('')).toEqual([]);
    expect(parseSkills(null)).toEqual([]);
    expect(parseSkills(undefined)).toEqual([]);
  });
});

describe('researcherOnboardingColumns', () => {
  it('maps wizard answers to row columns', () => {
    const cols = researcherOnboardingColumns({
      experience_level: 'expert',
      skills: 'XSS, SSRF',
      github: ' https://github.com/u ',
      website: 'https://me.dev',
    });
    expect(cols).toEqual({
      experience_level: 'expert',
      skills: ['XSS', 'SSRF'],
      github: 'https://github.com/u',
      website: 'https://me.dev',
    });
  });
  it('blank answers map to null / empty array', () => {
    const cols = researcherOnboardingColumns({ experience_level: '', skills: '', github: '', website: '' });
    expect(cols.experience_level).toBeNull();
    expect(cols.skills).toEqual([]);
    expect(cols.github).toBeNull();
    expect(cols.website).toBeNull();
  });
  it('accepts skills already as array', () => {
    expect(researcherOnboardingColumns({ skills: ['a', 'b', 'a'] }).skills).toEqual(['a', 'b']);
  });
});

describe('whitelist guards', () => {
  it('experience levels', () => {
    expect(isValidExperienceLevel('beginner')).toBe(true);
    expect(isValidExperienceLevel('pro')).toBe(false);
    expect(isValidExperienceLevel('')).toBe(false);
  });
  it('company sizes', () => {
    expect(isValidCompanySize('11-50')).toBe(true);
    expect(isValidCompanySize('1000+')).toBe(true);
    expect(isValidCompanySize('10-1')).toBe(false);
    expect(isValidCompanySize(undefined)).toBe(false);
  });
});

describe('analytics range helpers', () => {
  it('parseAnalyticsRange whitelists and falls back to 30', () => {
    expect(parseAnalyticsRange('7')).toBe(7);
    expect(parseAnalyticsRange('90')).toBe(90);
    expect(parseAnalyticsRange('12')).toBe(30);
    expect(parseAnalyticsRange('')).toBe(30);
    expect(parseAnalyticsRange(undefined)).toBe(30);
    expect(parseAnalyticsRange(['30'])).toBe(30);
  });

  it('buildRangeWindow produces contiguous daily buckets', () => {
    const now = new Date('2026-11-04T12:00:00.000Z');
    const win = buildRangeWindow(7, now);
    expect(win.days).toBe(7);
    expect(win.dayBuckets).toHaveLength(7);
    // buckets are contiguous: bucket i starts exactly when bucket i-1 ends
    for (let i = 1; i < win.dayBuckets.length; i++) {
      expect(win.dayBuckets[i].gte).toBe(win.dayBuckets[i - 1].lt);
    }
    // oldest bucket starts at now - 7 days
    expect(win.dayBuckets[0].gte).toBe('2026-10-28T12:00:00.000Z');
    expect(win.lt).toBe(now.toISOString());
    expect(ANALYTICS_RANGES).toEqual([7, 30, 90]);
  });

  it('sumNumeric handles strings, numbers and junk', () => {
    expect(sumNumeric([{ a: 10 }, { a: '2.5' }, { a: null }, { a: 'x' }, {}], 'a')).toBe(12.5);
  });

  it('countBy keeps zero buckets and counts only known values', () => {
    const rows = [{ s: 'submitted' }, { s: 'submitted' }, { s: 'closed' }, { s: 'bogus' }];
    expect(countBy(rows, 's', ['submitted', 'closed', 'draft'] as const)).toEqual({ submitted: 2, closed: 1, draft: 0 });
  });
});

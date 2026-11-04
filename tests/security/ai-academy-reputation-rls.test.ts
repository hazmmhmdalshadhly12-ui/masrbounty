/**
 * Static security assertions on the §19 additions to supabase/masrbounty.sql:
 * every new table must be RLS-protected, sensitive tables must expose no
 * write path to users, and the security-critical RPCs must enforce roles.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const SQL = readFileSync(join(process.cwd(), 'supabase', 'masrbounty.sql'), 'utf8');

// Extract the §19 block (from its header to EOF marker = end of file).
const SECTION_START = SQL.indexOf('-- 19. AI, ACADEMY, CERTIFICATES, REPUTATION LEVELS & REPORT LIMITS');
const S19 = SECTION_START >= 0 ? SQL.slice(SECTION_START) : '';

const NEW_TABLES = [
  'ai_settings',
  'ai_usage_logs',
  'academy_courses',
  'academy_lessons',
  'academy_enrollments',
  'academy_lesson_progress',
  'academy_quiz_attempts',
  'certificates',
  'reputation_events',
  'researcher_levels',
  'report_limit_overrides',
];

describe('masrbounty.sql §19 — RLS coverage for new tables', () => {
  it('the section exists', () => {
    expect(SECTION_START).toBeGreaterThan(0);
  });

  it.each(NEW_TABLES)('%s: RLS enabled', (t) => {
    expect(S19).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`);
  });

  it('ai_usage_logs has NO insert/update/delete policy (service-role writes only)', () => {
    expect(S19).not.toMatch(/CREATE POLICY "[^"]*" ON public\.ai_usage_logs FOR (INSERT|UPDATE|DELETE)/);
    expect(S19).toMatch(/CREATE POLICY "ai_usage_read_own" ON public\.ai_usage_logs FOR SELECT/);
  });

  it('reputation_events is append-only: read policy only + immutability trigger', () => {
    expect(S19).not.toMatch(/CREATE POLICY "[^"]*" ON public\.reputation_events FOR (INSERT|UPDATE|DELETE)/);
    expect(S19).toMatch(/CREATE POLICY "rep_events_read" ON public\.reputation_events FOR SELECT/);
    expect(S19).toContain('trg_rep_events_immutable BEFORE UPDATE OR DELETE ON public.reputation_events');
  });

  it('ai_settings writable by admin only', () => {
    expect(S19).toMatch(/CREATE POLICY "ai_settings_write" ON public\.ai_settings FOR UPDATE USING \(public\.has_role\('admin'\)\)/);
  });

  it('certificates writes are staff-only', () => {
    expect(S19).toMatch(/CREATE POLICY "certificates_staff_insert" ON public\.certificates FOR INSERT\s*\n?\s*WITH CHECK \(public\.has_role\('admin'\) OR public\.has_role\('moderator'\)\)/);
    expect(S19).toMatch(/CREATE POLICY "certificates_admin_delete" ON public\.certificates FOR DELETE USING \(public\.has_role\('admin'\)\)/);
  });

  it('researcher_levels readable by everyone but writable by admin only', () => {
    expect(S19).toMatch(/CREATE POLICY "levels_read" ON public\.researcher_levels FOR SELECT USING \(true\)/);
    expect(S19).toMatch(/CREATE POLICY "levels_admin_update" ON public\.researcher_levels FOR UPDATE\s*\n?\s*USING \(public\.has_role\('admin'\)\)/);
  });

  it('report_limit_overrides writable by admin only', () => {
    expect(S19).toMatch(/CREATE POLICY "rlo_admin_insert" ON public\.report_limit_overrides FOR INSERT WITH CHECK \(public\.has_role\('admin'\)\)/);
  });

  it('academy enrollments/progress/quiz are owner-bound', () => {
    expect(S19).toMatch(/CREATE POLICY "academy_enroll_insert"[\s\S]*?user_id = auth\.uid\(\)/);
    expect(S19).toMatch(/CREATE POLICY "academy_progress_insert"[\s\S]*?user_id = auth\.uid\(\)/);
    expect(S19).toMatch(/CREATE POLICY "academy_quiz_insert"[\s\S]*?user_id = auth\.uid\(\)/);
  });

  it('academy-materials bucket is private and course-folder-bound', () => {
    expect(S19).toMatch(/INSERT INTO storage\.buckets \(id, name, public\) VALUES \('academy-materials','academy-materials', false\)/);
    expect(S19).toMatch(/CREATE POLICY "academy_materials_admin_write"[\s\S]*?academy_courses c WHERE c\.id::text = \(storage\.foldername\(name\)\)\[1\]/);
  });
});

describe('masrbounty.sql §19 — security-critical functions', () => {
  it('adjust_reputation is admin-only and requires a reason', () => {
    const fn = S19.slice(S19.indexOf('FUNCTION public.adjust_reputation'));
    const body = fn.slice(0, fn.indexOf('END; $$'));
    expect(body).toContain("public.has_role('admin')");
    expect(body).toContain('p_reason IS NULL OR length(btrim(p_reason)) < 5');
  });

  it('issue_achievement_certificate requires a documented basis (≥10 chars)', () => {
    const fn = S19.slice(S19.indexOf('FUNCTION public.issue_achievement_certificate'));
    const body = fn.slice(0, fn.indexOf('END; $$'));
    expect(body).toContain("public.has_role('admin') OR public.has_role('moderator')");
    expect(body).toContain('length(btrim(p_reason)) < 10');
  });

  it('verify_certificate returns ONLY public columns (no user ids/emails in the OUTPUT signature)', () => {
    const fn = S19.slice(S19.indexOf('FUNCTION public.verify_certificate'));
    const signature = fn.slice(0, fn.indexOf(') AS $$'));
    expect(signature).toContain('certificate_number');
    expect(signature).toContain('holder_name');
    expect(signature).toContain('status');
    expect(signature).not.toMatch(/\bemail\b/);
    expect(signature).not.toMatch(/user_id/);
    expect(fn).toContain('SECURITY DEFINER STABLE');
  });

  it('issue_course_certificate can only fire for enrolled users at 100% progress', () => {
    const fn = S19.slice(S19.indexOf('FUNCTION public.issue_course_certificate'));
    const body = fn.slice(0, fn.indexOf('END; $$ LANGUAGE plpgsql SECURITY DEFINER'));
    expect(body).toContain('academy_enrollments WHERE course_id = p_course AND user_id = v_user');
    expect(body).toContain('v_done < v_total');
    expect(body).toContain('ON CONFLICT (user_id, type, course_id) DO NOTHING');
  });

  it('refresh_researcher_stats keeps bonus score and writes the ledger', () => {
    const fn = S19.slice(S19.indexOf('FUNCTION public.refresh_researcher_stats'));
    const body = fn.slice(0, fn.indexOf('END; $$ LANGUAGE plpgsql SECURITY DEFINER;'));
    expect(body).toContain('bonus_score');
    expect(body).toContain("platform_settings WHERE key = 'reputation_weights'");
    expect(body).toContain('INSERT INTO public.reputation_events');
    expect(body).toContain('reputation_weights');
  });

  it('no DROP TABLE / TRUNCATE anywhere in the new section (ignoring comments)', () => {
    const codeOnly = S19
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(codeOnly).not.toMatch(/DROP TABLE|TRUNCATE/i);
  });

  it('certificate numbers are unique and server-generated', () => {
    expect(S19).toContain("DEFAULT ('MB-CERT-' || lpad(nextval('certificate_number_seq')::TEXT, 6, '0'))");
  });
});

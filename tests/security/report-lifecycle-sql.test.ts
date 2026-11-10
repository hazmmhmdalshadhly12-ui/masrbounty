import fs from 'fs';

/**
 * Static SQL/source assertions for the professional report lifecycle
 * (migration 27 + its mirror in the base schema + the server actions).
 * DB-level behaviors are asserted against the migration text so a regression
 * that drops the triggers/policies fails CI before reaching production.
 */

const migration27 = fs.readFileSync('supabase/migrations/27_report_lifecycle.sql', 'utf8');
const base = fs.readFileSync('supabase/masrbounty.sql', 'utf8');
const companySvc = fs.readFileSync('features/company/services.ts', 'utf8');
const reportSvc = fs.readFileSync('features/reports/services.ts', 'utf8');
const attachments = fs.readFileSync('features/reports/attachments.ts', 'utf8');
const adminPage = fs.readFileSync('app/admin/reports/page.tsx', 'utf8');
const companyDetail = fs.readFileSync('app/company/reports/[id]/page.tsx', 'utf8');
const statuses = fs.readFileSync('constants/statuses.ts', 'utf8');

describe('migration 27: report lifecycle hardening', () => {
  test('spam is added to report_status enum additively', () => {
    expect(migration27).toMatch(/ADD VALUE 'spam'/);
    expect(migration27).toMatch(/enumlabel\s*=\s*'spam'/); // idempotent guard
    expect(base).toMatch(/CREATE TYPE report_status AS ENUM[^\n]*'spam'/);
  });

  test('P0 fix: researcher can submit their own draft (triage trigger exemption)', () => {
    expect(migration27).toMatch(/OLD\.status = 'draft' AND NEW\.status = 'submitted'/);
    expect(migration27).toMatch(/researcher_profiles rp[\s\S]*?rp\.user_id = auth\.uid\(\)/);
    // mirrored in the base schema too
    expect(base).toMatch(/OLD\.status = 'draft' AND NEW\.status = 'submitted'/);
  });

  test('transition map trigger exists and mirrors the canonical rules', () => {
    expect(migration27).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_enforce_report_transitions/);
    expect(migration27).toMatch(/CREATE TRIGGER trg_report_transitions BEFORE UPDATE ON public\.reports/);
    // key lifecycle rules (user spec: New→Triaged, Triaged→Accepted,
    // Triaged→Needs More Info, Triaged→Duplicate, Accepted→Resolved, Resolved→Closed)
    expect(migration27).toMatch(/WHEN 'submitted'\s+THEN ARRAY\['under_review','triaged','need_more_info'/);
    expect(migration27).toMatch(/WHEN 'triaged'\s+THEN ARRAY\['under_review','need_more_info','accepted'/);
    expect(migration27).toMatch(/WHEN 'accepted'\s+THEN ARRAY\['reward_approved','resolved','closed'\]/);
    expect(migration27).toMatch(/WHEN 'resolved'\s+THEN ARRAY\['closed'\]/);
    // closed is terminal + unknown source statuses denied (ELSE deny)
    expect(migration27).toMatch(/WHEN 'closed'\s+THEN ARRAY\[\]::TEXT\[\]/);
    expect(migration27).toMatch(/ELSE ARRAY\[\]::TEXT\[\]/);
    // never re-enter draft
    expect(migration27).toMatch(/invalid transition: % → draft/);
    // staff-only reopen
    expect(migration27).toMatch(/OLD\.status = 'closed' AND NEW\.status = 'under_review'/);
    // finance states reachable only through guarded transitions
    expect(migration27).toMatch(/WHEN 'reward_approved'\s+THEN ARRAY\['paid','accepted'\]/);
    // mirrored in the base schema
    expect(base).toMatch(/fn_enforce_report_transitions/);
    expect(base).toMatch(/CREATE TRIGGER trg_report_transitions BEFORE UPDATE ON public\.reports/);
  });

  test('evidence integrity: content immutable after submission', () => {
    expect(migration27).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_protect_report_content/);
    expect(migration27).toMatch(/CREATE TRIGGER trg_protect_report_content BEFORE UPDATE ON public\.reports/);
    expect(migration27).toMatch(/report content is locked after submission/);
    expect(migration27).toMatch(/original report content is immutable/);
    expect(base).toMatch(/fn_protect_report_content/);
  });

  test('reference number gains a year segment (MB-YYYY-000001)', () => {
    expect(migration27).toMatch(/'MB-' \|\| to_char\(now\(\), 'YYYY'\) \|\| '-' \|\| lpad/);
    expect(base).toMatch(/'MB-' \|\| to_char\(now\(\), 'YYYY'\)/);
  });

  test('rep_insert re-checks program active + visibility/invitation (IDOR hardening)', () => {
    expect(migration27).toMatch(/DROP POLICY IF EXISTS "rep_insert" ON public\.reports/);
    expect(migration27).toMatch(/p\.status = 'active'/);
    expect(migration27).toMatch(/p\.visibility = 'public'/);
    expect(migration27).toMatch(/program_researchers pri[\s\S]*?pri\.status = 'accepted'/);
    expect(base).toMatch(/program_researchers pri/);
  });

  test('inbox/list indexes exist', () => {
    expect(migration27).toMatch(/idx_reports_submitted_at ON public\.reports\(submitted_at DESC\)/);
    expect(migration27).toMatch(/idx_reports_updated_at ON public\.reports\(updated_at DESC\)/);
    expect(base).toMatch(/idx_reports_submitted_at/);
  });

  test('award_bounty no longer downgrades decided reports', () => {
    expect(migration27).toMatch(/status IN \('submitted','under_review','need_more_info','triaged','accepted'\)/);
    expect(base).toMatch(/status IN \('submitted','under_review','need_more_info','triaged','accepted'\)/);
  });
});

describe('server actions: lifecycle + reasons + notifications', () => {
  test('company triage validates transitions and requires a decision reason', () => {
    expect(companySvc).toMatch(/canTransition\(fromStatus, status\)/);
    expect(companySvc).toMatch(/REASON_REQUIRED_STATUSES/);
    expect(companySvc).toMatch(/سبب القرار مطلوب/);
    // finance states can never be set by plain triage
    expect(companySvc).toMatch(/COMPANY_TRIAGE_STATUSES/);
    expect(companySvc).not.toMatch(/'reward_approved',\s*\n\s*'paid'/);
  });

  test('admin triage validates transitions, may reopen closed, and no longer duplicates events', () => {
    expect(adminPage).toMatch(/canTransition\([\s\S]*\{ staff: true \}\)/);
    // the old duplicate report_events insert (manual status event on top of
    // the DB trigger) is gone; only the reason note event remains.
    expect(adminPage).not.toMatch(/report_events[^;]*to_status: to/);
    expect(adminPage).toMatch(/سبب القرار/);
  });

  test('submission notifies the company and confirms success to the researcher', () => {
    expect(reportSvc).toMatch(/تقرير جديد وارد/); // company notification
    expect(reportSvc).toMatch(/تم إرسال التقرير بنجاح/); // researcher confirmation
    expect(reportSvc).toMatch(/reportParties\(supabase, reportId\)/);
    // guarded submit: only a draft owned by the researcher can flip
    expect(reportSvc).toMatch(/\.eq\('status', 'draft'\)/);
    // no silent fake reference numbers
    expect(reportSvc).not.toMatch(/MB-\$\{Date\.now\(\)\}/);
  });

  test('attachment downloads use participant-checked signed URLs', () => {
    expect(attachments).toMatch(/createSignedUrl/);
    expect(attachments).toMatch(/isOwner && !isMember && !isStaff/); // participant gate
    expect(attachments).toMatch(/createSignedUrl\(att\.file_path, 300\)/); // short-lived
  });

  test('company detail page renders only lifecycle-legal transitions + attachments', () => {
    expect(companyDetail).toMatch(/allowedTransitions\(report\.status\)/);
    expect(companyDetail).toMatch(/downloadAttachmentAction/); // attachments visible to company
  });

  test('canonical status module is the single source (15 statuses, spam included)', () => {
    expect(statuses).toMatch(/'spam'/);
    expect(statuses).toMatch(/REPORT_TRANSITIONS: Readonly<Record<ReportStatus, readonly ReportStatus\[\]>>/);
    expect(statuses).toMatch(/UNREVIEWED_REPORT_STATUSES: readonly ReportStatus\[\] = \['submitted'\]/);
  });
});

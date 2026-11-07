import fs from 'fs';

/**
 * Legal system v1 (migrations 25 + 26) — structure invariants:
 *  - 12 policy documents seeded, published, with version 1 content;
 *  - the three registration docs gate logins (requires_reacceptance=true);
 *  - published versions are IMMUTABLE (DB trigger blocks UPDATE/DELETE);
 *  - acceptance rows are append-only; inserts only via the SECURITY
 *    DEFINER RPC that validates age + current versions server-side;
 *  - publishing is draft -> published only and supersedes the previous.
 */
const m25 = fs.readFileSync('supabase/migrations/25_legal_system.sql', 'utf8');
const m26 = fs.readFileSync('supabase/migrations/26_legal_seed.sql', 'utf8');

const DOCS = [
  'terms-of-service', 'privacy-policy', 'disclaimer', 'responsible-disclosure',
  'bug-bounty-rules', 'company-agreement', 'researcher-agreement',
  'rewards-payment', 'dispute-resolution', 'suspension-termination',
  'prohibited-activities', 'data-retention',
];

describe('migration 25: tables + RLS', () => {
  test('three legal tables exist with RLS enabled', () => {
    for (const t of ['legal_documents', 'legal_document_versions', 'legal_acceptances']) {
      expect(m25).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t}`));
      expect(m25).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`));
    }
  });
  test('version rows are UNIQUE per (document, version)', () => {
    expect(m25).toMatch(/UNIQUE\(document_id, version\)/);
  });
  test('published/superseded versions are immutable via trigger', () => {
    expect(m25).toMatch(/CREATE TRIGGER legal_ver_immutable\s+BEFORE UPDATE OR DELETE ON public\.legal_document_versions/);
    expect(m25).toMatch(/IF OLD\.status <> 'draft' THEN\s+RAISE EXCEPTION 'published legal versions are immutable/);
  });
  test('acceptance rows are append-only (no UPDATE/DELETE, ever)', () => {
    expect(m25).toMatch(/CREATE TRIGGER legal_acc_immutable\s+BEFORE UPDATE OR DELETE ON public\.legal_acceptances/);
    expect(m25).toMatch(/RAISE EXCEPTION 'legal_acceptances is append-only \(immutable consent record\)'/);
  });
  test('no client INSERT policy on acceptances (RPC-only writes)', () => {
    const block = m25.match(/DROP POLICY IF EXISTS "la_select_own"[\s\S]*?(?=-- 25\.4)/)?.[0] ?? '';
    expect(block).not.toMatch(/FOR INSERT/);
  });
  test('anon can READ documents and published versions', () => {
    expect(m25).toMatch(/CREATE POLICY "ld_select" ON public\.legal_documents FOR SELECT USING \(true\)/);
    expect(m25).toMatch(/CREATE POLICY "ldv_select" ON public\.legal_document_versions FOR SELECT\s+USING \(status IN \('published','superseded'\) OR public\.has_role\('admin'\)\)/);
  });
});

describe('migration 25: RPCs', () => {
  test('publish Legal version: admin-only, draft->published only', () => {
    expect(m25).toMatch(/CREATE OR REPLACE FUNCTION public\.publish_legal_version\([\s\S]*?LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp/);
    const body = m25.match(/FUNCTION public\.publish_legal_version\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/NOT public\.has_role\('admin'\) THEN RAISE EXCEPTION 'forbidden'/);
    expect(body).toMatch(/WHERE document_id = v_doc AND version = p_version AND status = 'draft'/);
    expect(body).toMatch(/IF NOT EXISTS \(/);
    expect(body).toMatch(/SET status = 'superseded'/);
  });
  test('accept_legal_agreement validates age + exact current versions server-side', () => {
    const body = m25.match(/FUNCTION public\.accept_legal_agreement\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/IF p_age_confirmed IS NOT TRUE THEN RAISE EXCEPTION 'age confirmation required'/);
    expect(body).toMatch(/IF p_versions\[i\] IS NULL OR p_versions\[i\] <> v_current THEN/);
    expect(body).toMatch(/RAISE EXCEPTION 'version mismatch: %', p_slugs\[i\]/);
    expect(body).toMatch(/array_length\(p_slugs,1\) <> array_length\(p_versions,1\)/);
  });
  test('get_required_legal_docs only returns docs requiring re-acceptance with stale versions', () => {
    const body = m25.match(/FUNCTION public\.get_required_legal_docs\([\s\S]*?END; \$\$ LANGUAGE plpgsql/)?.[0] ?? '';
    expect(body).toMatch(/d\.status = 'published' AND d\.requires_reacceptance/);
    expect(body).toMatch(/a2\.version >= d\.current_version/);
  });
});

describe('migration 26: seeded policy documents', () => {
  test('all 12 documents are seeded as published v1', () => {
    for (const slug of DOCS) {
      expect(m26).toMatch(new RegExp(`'${slug}'`));
    }
    expect(m26.match(/INSERT INTO public\.legal_documents/g)?.length).toBe(12);
    expect(m26.match(/INSERT INTO public\.legal_document_versions/g)?.length).toBe(12);
  });
  test('registration docs gate logins (requires_reacceptance = true)', () => {
    for (const slug of ['terms-of-service', 'privacy-policy', 'responsible-disclosure']) {
      const block = m26.match(new RegExp(`INSERT INTO public\\.legal_documents[\\s\\S]*?'${slug}'[\\s\\S]*?ON CONFLICT \\(slug\\) DO NOTHING`))?.[0] ?? '';
      expect(block).toMatch(/, true\)\s+ON CONFLICT/);
    }
  });
  test('every seed content includes the Egyptian-lawyer-review warning', () => {
    const blocks = m26.match(/\$md\$[\s\S]*?\$md\$/g) ?? [];
    expect(blocks.length).toBe(12);
    for (const b of blocks) {
      expect(b).toMatch(/لم تتم مراجعتها بعد من قبل محامٍ مرخّص في مصر/);
    }
  });
  test('seeds are idempotent (never overwrite existing docs/versions)', () => {
    expect(m26.match(/ON CONFLICT \(slug\) DO NOTHING/g)?.length).toBe(12);
    expect(m26.match(/NOT EXISTS \(SELECT 1 FROM public\.legal_document_versions v WHERE v\.document_id = d\.id AND v\.version = 1\)/g)?.length).toBe(12);
  });
});

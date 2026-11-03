/**
 * Storage bucket policies (Phase 7 acceptance), asserted against the SQL:
 *  - report-attachments is PRIVATE and path-bound to the report (folder[1]=report id)
 *  - identity-documents is PRIVATE and user-bound
 *  - avatars/company-logos writes are bound to owner folders (16.3)
 *  - buckets table: attachments/identity private, avatars/logos public
 */
import fs from 'fs';

const sql = fs.readFileSync('supabase/masrbounty.sql', 'utf8');

function lastPolicy(name: string): string {
  const re = new RegExp(`CREATE POLICY "${name}" ON storage\\.objects[\\s\\S]*?;`, 'g');
  const all = [...sql.matchAll(re)];
  expect(all.length) /* `policy ${name} must exist` */.toBeGreaterThan(0);
  return all[all.length - 1]![0];
}

describe('storage: private buckets', () => {
  test('report-attachments bucket is not public', () => {
    const buckets = sql.match(/INSERT INTO storage\.buckets[\s\S]*?;/g) ?? [];
    const main = buckets.find((b) => b.includes("'report-attachments'"));
    expect(main).toBeDefined();
    // main bucket insert lists report-attachments as false (private)
    expect(main).toMatch(/'report-attachments'\s*,\s*'report-attachments'\s*,\s*false/);
  });

  test('attachments SELECT is path-bound to the report and requires a session', () => {
    const pol = lastPolicy('attach_private');
    expect(pol).toMatch(/bucket_id\s*=\s*'report-attachments'/);
    expect(pol).toMatch(/auth\.role\(\)\s*=\s*'authenticated'/);
    expect(pol).toMatch(/storage\.foldername\(name\)\)\[1\]\)?::uuid/);
    expect(pol).toMatch(/researcher_profiles|company_members|has_role/);
  });

  test('attachments INSERT requires authenticated role (v2 policy)', () => {
    const v2 = fs.readFileSync('supabase/security-hardening-v2.sql', 'utf8');
    const m = v2.match(/CREATE POLICY "attach_upload" ON storage\.objects[\s\S]*?;/);
    expect(m).toBeDefined();
    expect(m![0]).toMatch(/auth\.role\(\)\s*=\s*'authenticated'/);
    // upload path must stay inside the report folder
    expect(m![0]).toMatch(/foldername/);
  });

  test('identity-documents is private and user-bound (v2)', () => {
    const buckets = sql.match(/INSERT INTO storage\.buckets[\s\S]*?;/g) ?? [];
    expect(buckets.some((b) => b.includes("'identity-documents','identity-documents', false"))).toBe(true);
    const v2 = fs.readFileSync('supabase/security-hardening-v2.sql', 'utf8');
    for (const name of ['iddoc_select', 'iddoc_upload', 'iddoc_update', 'iddoc_delete']) {
      const m = v2.match(new RegExp(`CREATE POLICY "${name}" ON storage\\.objects[\\s\\S]*?;`));
      expect(m).toBeDefined(); /* name */
      expect(m![0]).toMatch(/identity-documents/);
      expect(m![0]).toMatch(/auth\.uid\(\)/);
    }
  });
});

describe('storage: public buckets are write-path-bound (16.3)', () => {
  test('avatars: INSERT/UPDATE only inside auth.uid() folder', () => {
    for (const name of ['avatars_upload', 'avatars_update']) {
      const pol = lastPolicy(name);
      expect(pol).toMatch(/bucket_id\s*=\s*'avatars'/);
      expect(pol).toMatch(/auth\.role\(\)\s*=\s*'authenticated'/);
      expect(pol).toMatch(/foldername\(name\)\)\[1\]\)?\s*=\s*auth\.uid\(\)::text/);
    }
  });

  test('company-logos: INSERT/UPDATE only inside a company you own/are member of', () => {
    for (const name of ['logos_upload', 'logos_update']) {
      const pol = lastPolicy(name);
      expect(pol).toMatch(/bucket_id\s*=\s*'company-logos'/);
      expect(pol).toMatch(/foldername\(name\)\)\[1\]\)?\s*=\s*cp\.id::text/);
      expect(pol).toMatch(/owner_id\s*=\s*auth\.uid\(\)|is_company_member/);
    }
  });

  test('old unbounded upload policies are gone (no anonymous-style INSERT without path check)', () => {
    const legacy = 'CREATE POLICY "avatars_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id=\'avatars\' AND auth.role()=\'authenticated\');';
    expect(sql.includes(legacy)).toBe(false);
  });
});

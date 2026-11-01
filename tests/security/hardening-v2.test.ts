import fs from 'fs';

/**
 * Static assertions for the v2 security hardening patch
 * (supabase/security-hardening-v2.sql), applied to the full masrbounty.sql
 * the same way p0-rls.test.ts evaluates effective (last-wins) policies.
 */
const sql = fs.readFileSync('supabase/masrbounty.sql', 'utf8');

function effectivePolicies(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /CREATE POLICY "([^"]+)" ON (\S+) FOR (ALL|SELECT|INSERT|UPDATE|DELETE)([\s\S]*?);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.set(`${m[2]}.${m[1]}`, m[0]);
  }
  return out;
}

describe('Security hardening v2 (patched policies are effective)', () => {
  const pols = effectivePolicies();

  test('identity-documents: select is owner-scoped or staff, not all-authenticated', () => {
    const sel = pols.get('storage.objects.iddoc_select');
    expect(sel).toBeDefined();
    expect(sel!).not.toMatch(/auth\.role\(\)\s*=\s*'authenticated'\s*\)/); // bare authenticated check must be nested with owner scope
    expect(sel!).toMatch(/researcher_profiles/);
    expect(sel!).toMatch(/has_role\('admin'\)|has_role\('moderator'\)/);
    const up = pols.get('storage.objects.iddoc_upload');
    expect(up).toBeDefined();
    expect(up!).toMatch(/researcher_profiles/); // upload restricted to own folder
  });

  test('report_comments insert requires report participation, not just author id', () => {
    const ins = pols.get('public.report_comments.rc_insert');
    expect(ins).toBeDefined();
    expect(ins!).toMatch(/author_id\s*=\s*auth\.uid\(\)/);
    expect(ins!).toMatch(/EXISTS/);
    expect(ins!).toMatch(/reports/);
  });

  test('report_attachments insert requires participation', () => {
    const ins = pols.get('public.report_attachments.ra_insert');
    expect(ins).toBeDefined();
    expect(ins!).toMatch(/uploaded_by\s*=\s*auth\.uid\(\)/);
    expect(ins!).toMatch(/EXISTS/);
  });

  test('dispute_messages insert requires dispute participation', () => {
    const ins = pols.get('public.dispute_messages.dmsg_insert');
    expect(ins).toBeDefined();
    expect(ins!).toMatch(/author_id\s*=\s*auth\.uid\(\)/);
    expect(ins!).toMatch(/disputes/);
  });

  test('join tables are no longer anon-readable (USING true removed)', () => {
    for (const key of [
      'public.report_label_links.rll_read',
      'public.report_duplicates.rd_read',
      'public.report_assignees.ras_read',
      'public.researcher_program_activity.rpa_read',
      'public.program_researchers.prg_res_read',
    ]) {
      const pol = pols.get(key);
      expect(pol).toBeDefined();
      expect(pol).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    }
  });

  test('money RPCs enforce company rank, not mere membership', () => {
    expect(sql).toMatch(/has_company_permission\(v_company,\s*'triage'\)/);
    expect(sql).toMatch(/has_company_permission\(v_company,\s*'manage_payouts'\)/);
    // pay_award rejects awards that were never approved.
    // CREATE OR REPLACE means the LAST definition wins — evaluate that one.
    const defs = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.pay_award[\s\S]*?\$\$ LANGUAGE/g)];
    expect(defs.length).toBeGreaterThan(0);
    const effective = defs[defs.length - 1]![0];
    expect(effective).toMatch(/v_status <> 'approved'/);
    expect(effective).toMatch(/has_company_permission\(v_company,\s*'manage_payouts'\)/);
  });

  test('admin tooling works under RLS (profiles update, user_roles admin write)', () => {
    const prof = pols.get('public.profiles.profiles_own_update');
    expect(prof).toBeDefined();
    expect(prof!).toMatch(/has_role\('admin'\)/);
    expect(pols.get('public.user_roles.roles_admin_write')).toBeDefined();
    expect(pols.get('public.user_roles.roles_admin_delete')).toBeDefined();
  });

  test('reports triage fields protected from owner self-mutation via trigger', () => {
    expect(sql).toMatch(/protect_report_triage_fields/);
    expect(sql).toMatch(/CREATE TRIGGER trg_protect_report_triage/);
  });

  test('wallet transactions query in researcher dashboard is wallet-scoped (code)', () => {
    const page = fs.readFileSync('app/dashboard/wallet/page.tsx', 'utf8');
    expect(page).toMatch(/wallet_transactions[\s\S]*?eq\('wallet_id',\s*wallet\.id\)/);
  });

  test('company programs listing is membership-scoped (code)', () => {
    const page = fs.readFileSync('app/company/programs/page.tsx', 'utf8');
    expect(page).toMatch(/company_members/);
    expect(page).toMatch(/in\('company_id'/);
    // must NOT select all programs unfiltered
    expect(page).not.toMatch(/from\('programs'\)[\s\S]{0,80}limit\(100\)/);
  });

  test('no hardcoded escrow phone number remains (code)', () => {
    for (const f of ['app/company/payments/page.tsx', 'app/admin/payments/page.tsx']) {
      expect(fs.readFileSync(f, 'utf8')).not.toMatch(/0112417443/);
    }
  });

  test('company_researcher_stats RPC has membership guard', () => {
    const fn = sql.match(/CREATE OR REPLACE FUNCTION public\.company_researcher_stats[\s\S]*?\$\$ LANGUAGE/)?.[0] ?? '';
    expect(fn).toMatch(/company_members|company_profiles/);
    expect(fn).toMatch(/has_role\('admin'\)/);
  });
});

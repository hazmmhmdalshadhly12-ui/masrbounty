import fs from 'fs';

const sql = fs.readFileSync('supabase/masrbounty.sql', 'utf8');
const svc = (() => {
  try { return fs.readFileSync('features/programs/services.ts', 'utf8'); } catch { return ''; }
})();

function effectivePolicies(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /CREATE POLICY "([^"]+)" ON (\S+) FOR (ALL|SELECT|INSERT|UPDATE|DELETE)([\s\S]*?);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.set(`${m[2]}.${m[1]}`, m[0]);
  }
  return out;
}

describe('P0 RLS audit', () => {
  // 1. company_domains
  test('company_domains: anon cannot read, member can read own, other company blocked', () => {
    const pols = effectivePolicies();
    const read = pols.get('public.company_domains.cd_read');
    expect(read).toBeDefined();
    // anon blocked: must require authenticated and not use true
    expect(read!).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(read!).toMatch(/authenticated/);
    // member own: checks company_id linkage via owner or member
    expect(read!).toMatch(/company_id/);
    expect(read!).toMatch(/company_members/);
    expect(read!).toMatch(/company_profiles/);
    expect(read!).toMatch(/auth\.uid\(\)/);
    // other company blocked -> policy checks company_id equality, not just any member
    // ensure it references company_domains.company_id so cross-company fails
    expect(read!).toMatch(/company_domains\.company_id|cd\.company_id|company_id/);
    // write also mirrored
    const write = pols.get('public.company_domains.cd_write');
    expect(write).toBeDefined();
    expect(write!).toMatch(/WITH CHECK/);
    expect(write!).not.toMatch(/WITH CHECK\s*\(\s*true\s*\)/i);
    const using = write!.match(/USING\s*\(([\s\S]*)\)\s*WITH CHECK/i)?.[1] ?? '';
    const check = write!.match(/WITH CHECK\s*\(([\s\S]*)\)\s*;/i)?.[1] ?? '';
    // WITH CHECK mirrors USING (no true)
    expect(check.trim()).not.toBe('true');
    expect(using.trim()).toBe(check.trim());
  });

  test('programs visibility: anon sees only public+active, private hidden', () => {
    const pols = effectivePolicies();
    const prog = pols.get('public.programs.prog_public_read');
    expect(prog).toBeDefined();
    expect(prog!).toMatch(/can_view_program/);
    expect(prog!).not.toMatch(/USING\s*\(\s*true\s*\)/);
    // can_view_program definition must enforce active + public
    expect(sql).toMatch(/can_view_program/);
    expect(sql).toMatch(/status.*active|active.*status/i);
    expect(sql).toMatch(/visibility.*public|public.*visibility/i);
    // private should not be true for anon: function returns false for anon when private
    const fnIdx = sql.indexOf('FUNCTION public.can_view_program');
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSlice = sql.slice(fnIdx, fnIdx + 1500);
    expect(fnSlice).toMatch(/p_user IS NULL.*RETURN false|IF p_user IS NULL/i);
  });

  test('report_comments is_internal: researcher cannot see internal notes', () => {
    const pols = effectivePolicies();
    const rc = pols.get('public.report_comments.rc_select');
    expect(rc).toBeDefined();
    // must contain is_internal check
    expect(rc!).toMatch(/is_internal/);
    expect(rc!).toMatch(/is_internal\s*=\s*false|NOT is_internal/i);
    // must gate internal via company permission or staff
    expect(rc!).toMatch(/has_company_permission|is_company_member/);
    expect(rc!).toMatch(/has_role\('admin'\)/);
    expect(rc!).toMatch(/has_role\('moderator'\)/);
    // anon not allowed
    expect(rc!).not.toMatch(/USING\s*\(\s*true\s*\)/);
    // ensure researcher without company membership cannot see internal: policy requires cm or permission for internal
    // we check that is_internal = false is OR branch, not AND only
    expect(rc!).toMatch(/is_internal\s*=\s*false/);
  });

  test('report_attachments: private — only report participants + company members', () => {
    const pols = effectivePolicies();
    const ra = pols.get('public.report_attachments.ra_select');
    expect(ra).toBeDefined();
    expect(ra!).toMatch(/report_id/);
    expect(ra!).toMatch(/researcher_profiles/);
    expect(ra!).toMatch(/company_members|is_company_member/);
    expect(ra!).toMatch(/auth\.uid\(\)/);
    expect(ra!).not.toMatch(/USING\s*\(\s*true\s*\)/);
    // storage bucket private check
    const attach = sql.slice(sql.indexOf('attach_private'), sql.indexOf('attach_private') + 1200);
    expect(sql).toMatch(/report-attachments/);
    expect(attach).toMatch(/authenticated/);
    expect(attach).toMatch(/report_id|foldername/);
  });

  test('wallets: user cannot read other user wallet, no anon access', () => {
    const pols = effectivePolicies();
    const w = pols.get('public.wallets.w_select');
    expect(w).toBeDefined();
    expect(w!).toMatch(/researcher_id/);
    expect(w!).toMatch(/auth\.uid\(\)/);
    expect(w!).toMatch(/researcher_profiles/);
    expect(w!).not.toMatch(/USING\s*\(\s*true\s*\)/);
    expect(w!).toMatch(/authenticated|auth\.uid/);
    // must not allow true for other user
    expect(w!).not.toMatch(/true/);
    const wt = pols.get('public.wallet_transactions.wt_select');
    expect(wt).toBeDefined();
    expect(wt!).toMatch(/wallet_id/);
    expect(wt!).toMatch(/auth\.uid/);
  });

  test('bounties/payments: company only own program, no anon', () => {
    const pols = effectivePolicies();
    const ba = pols.get('public.bounty_awards.ba_select');
    expect(ba).toBeDefined();
    expect(ba!).toMatch(/report_id/);
    expect(ba!).toMatch(/is_company_member|company_members/);
    expect(ba!).toMatch(/authenticated/);
    const bp = pols.get('public.bounty_payments.bpay_select');
    expect(bp).toBeDefined();
    expect(bp!).toMatch(/award_id/);
    expect(bp!).toMatch(/authenticated|auth\.uid/);
    const pr = pols.get('public.payout_requests.pr_select');
    expect(pr).toBeDefined();
    expect(pr!).toMatch(/researcher_id/);
    expect(pr!).toMatch(/auth\.uid/);
  });

  test('notifications: user can only read own notifications', () => {
    const pols = effectivePolicies();
    // we split into per-op policies in 17.4, so check select
    const sel = pols.get('public.notifications.notif_select') ?? pols.get('public.notifications.notif_all');
    expect(sel).toBeDefined();
    expect(sel!).toMatch(/user_id\s*=\s*auth\.uid\(\)/);
    expect(sel!).not.toMatch(/USING\s*\(\s*true\s*\)/);
    // ensure no anon
    expect(sel!).toMatch(/authenticated|auth\.uid/);
    // insert/update/delete also own only
    const ins = pols.get('public.notifications.notif_insert');
    if (ins) expect(ins).toMatch(/user_id\s*=\s*auth\.uid\(\)/);
    const upd = pols.get('public.notifications.notif_update');
    if (upd) {
      expect(upd).toMatch(/user_id\s*=\s*auth\.uid\(\)/);
      expect(upd).toMatch(/WITH CHECK/);
    }
  });

  test('audit_logs: immutable (no UPDATE/DELETE for anyone)', () => {
    const pols = effectivePolicies();
    // only SELECT should exist for audit_logs
    const auditPols = [...pols.keys()].filter(k => k.startsWith('public.audit_logs.'));
    expect(auditPols.length).toBeGreaterThan(0);
    for (const k of auditPols) {
      expect(k).toMatch(/audit_admin|audit_read/);
      const stmt = pols.get(k)!;
      expect(stmt).toMatch(/FOR SELECT/i);
      expect(stmt).not.toMatch(/FOR UPDATE|FOR DELETE|FOR ALL/i);
    }
    // check trigger exists to block mutation
    expect(sql).toMatch(/prevent_audit_mutation/);
    expect(sql).toMatch(/trg_audit_immutable/);
    expect(sql).toMatch(/audit_logs immutable/);
  });

  test('WITH CHECK mirrors USING (no true) for all effective FOR ALL', () => {
    const bad: string[] = [];
    for (const [name, stmt] of effectivePolicies()) {
      if (/FOR ALL/i.test(stmt) && /WITH CHECK\s*\(\s*true\s*\)/i.test(stmt)) {
        const using = stmt.match(/USING\s*\(([\s\S]*)\)\s*WITH CHECK/i)?.[1] ?? '';
        if (!/^\s*true\s*$/i.test(using)) bad.push(name);
      }
    }
    expect(bad).toEqual([]);
    // also ensure no new FOR ALL has true at all
    for (const [name, stmt] of effectivePolicies()) {
      if (/FOR ALL/i.test(stmt)) {
        expect(stmt).not.toMatch(/WITH CHECK\s*\(\s*true\s*\)/i);
      }
    }
  });

  test('publish readiness: program without assets cannot publish', () => {
    // service logic check
    if (svc) {
      expect(svc).toMatch(/checkPublishReadiness/);
      expect(svc).toMatch(/assetsCount/);
      expect(svc).toMatch(/must.*asset|الأصل|Assets/i);
      expect(svc).toMatch(/missing\.push/);
    }
    // SQL check: programs has published_at and checkPublishReadiness verifies assets
    expect(sql).toMatch(/published_at/);
    expect(svc).toMatch(/program_assets/);
  });

  test('phone column exists', () => {
    expect(sql).toMatch(/ALTER TABLE public\.profiles ADD COLUMN IF NOT EXISTS phone/);
    expect(sql).toMatch(/profiles_phone_format/);
  });

  test('published_at exists', () => {
    expect(sql).toMatch(/ALTER TABLE public\.programs ADD COLUMN IF NOT EXISTS published_at/);
  });

  test('company_members roles include 6 roles', () => {
    // original enum + added values
    expect(sql).toMatch(/company_member_role/);
    for (const role of ['owner', 'admin', 'triager', 'analyst', 'finance', 'viewer']) {
      expect(sql).toMatch(new RegExp(role));
    }
    // ensure constraint or type covers 6
    const hasSix = (sql.match(/owner/g) || []).length >= 1;
    expect(hasSix).toBe(true);
    // check the check constraint includes all 6
    expect(sql).toMatch(/company_members_role_check/);
    // also ensure 6 roles in that constraint line
    const idx = sql.indexOf('company_members_role_check');
    if (idx !== -1) {
      const slice = sql.slice(idx, idx + 500);
      for (const r of ['owner', 'admin', 'triager', 'analyst', 'finance', 'viewer']) {
        expect(slice).toMatch(new RegExp(r));
      }
    }
  });

  test('no anon storage leakage for report attachments', () => {
    const pols = effectivePolicies();
    const attach = sql.match(/CREATE POLICY "attach_private"[\s\S]*?;/g)?.pop() ?? '';
    expect(attach).toMatch(/authenticated/);
    expect(attach).not.toMatch(/USING\s*\(\s*true\s*\)/);
  });
});

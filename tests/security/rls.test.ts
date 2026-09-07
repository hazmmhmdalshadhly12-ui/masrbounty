import fs from 'fs';

const sql = fs.readFileSync('supabase/masrbounty.sql', 'utf8');

/** Effective (last) CREATE POLICY statement per policy name. */
function effectivePolicies(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /CREATE POLICY "([^"]+)" ON (\S+) FOR (ALL|SELECT|INSERT|UPDATE|DELETE)([\s\S]*?);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.set(`${m[2]}.${m[1]}`, m[0]);
  }
  return out;
}

test('service key never in client bundle', () => {
  const src = fs.readFileSync('lib/supabase/client.ts', 'utf8');
  expect(src).not.toMatch('SERVICE_ROLE');
});

test('no permissive WITH CHECK (true) on restricted FOR ALL policies', () => {
  // Root cause of the platform_settings injection: INSERT only checks the
  // WITH CHECK clause, so it must mirror its USING clause.
  const bad: string[] = [];
  for (const [name, stmt] of effectivePolicies()) {
    if (/FOR ALL/i.test(stmt) && /WITH CHECK\s*\(\s*true\s*\)/i.test(stmt)) {
      const using = stmt.match(/USING\s*\(([\s\S]*)\)\s*WITH CHECK/i)?.[1] ?? '';
      if (!/^\s*true\s*$/i.test(using)) bad.push(name);
    }
  }
  expect(bad).toEqual([]);
});

test('sensitive settings key is not publicly readable', () => {
  expect(sql).toMatch(/vf_cash_number/);
  const idx = sql.lastIndexOf('CREATE POLICY "pset_read"');
  const clause = sql.slice(idx, idx + 900);
  expect(clause).toMatch(/has_role\('admin'\)/);
});

test('profiles are not anonymously enumerable', () => {
  const idx = sql.lastIndexOf('CREATE POLICY "profiles_public_read"');
  const clause = sql.slice(idx, idx + 300);
  expect(clause).not.toMatch(/USING\s*\(\s*true\s*\)/);
  expect(clause).toMatch('authenticated');
});

test('money moves only through SECURITY DEFINER functions', () => {
  for (const fn of ['award_bounty', 'pay_award', 'settle_payout']) {
    expect(sql).toMatch(new RegExp(`FUNCTION public\\.${fn}`));
    expect(sql).toMatch(/SECURITY DEFINER/);
  }
});

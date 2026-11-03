/**
 * CI/CD integrity (Phase 12 acceptance): the workflow that guards this repo
 * must actually trigger and run the full gate. Regression guard for the
 * corrupted `branches: ain]` YAML.
 */
import fs from 'fs';
import path from 'path';

const ciPath = path.join('.github', 'workflows', 'ci.yml');
const deployPath = path.join('.github', 'workflows', 'deploy.yml');

function parseSimpleYaml(src: string): Record<string, unknown> {
  // Minimal YAML parse sufficient for structure assertions (no external dep).
  const lines = src.split('\n');
  const stack: { indent: number; obj: Record<string, unknown> }[] = [
    { indent: -1, obj: {} as Record<string, unknown> },
  ];
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const m = raw.match(/^(\s*)([\w.-]+):\s*(.*)$/);
    if (!m) continue;
    const [, , key, value] = m;
    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) stack.pop();
    const parent = stack[stack.length - 1]!.obj;
    if (value === '') {
      const child: Record<string, unknown> = {};
      parent[key!] = child;
      stack.push({ indent, obj: child });
    } else if (value.startsWith('[')) {
      parent[key!] = value.replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      parent[key!] = value.replace(/^["']|["']$/g, '');
    }
  }
  return stack[0]!.obj;
}

describe('CI workflow integrity', () => {
  const ci = fs.readFileSync(ciPath, 'utf8');
  const parsed = parseSimpleYaml(ci);

  test('push/PR triggers reference an existing branch literal [main]', () => {
    const on = parsed['on'] as Record<string, Record<string, string[]>>;
    expect(on).toBeDefined();
    for (const trigger of ['push', 'pull_request']) {
      expect(Array.isArray(on[trigger]?.branches)) /* `${trigger}.branches must be a list` */.toBe(true);
      expect(on[trigger]!.branches).toContain('main');
      // regression guard: the corrupted value must never return
      expect(on[trigger]!.branches).not.toContain('ain]');
    }
  });

  test('gate covers typecheck, lint, unit, build, cloudflare build, e2e', () => {
    const jobs = Object.keys(parsed.jobs as Record<string, unknown>);
    for (const job of ['typecheck', 'lint', 'unit', 'build', 'cloudflare', 'e2e']) {
      expect(jobs) /* `job ${job} missing` */.toContain(job);
    }
  });

  test('unit gate runs jest; e2e gate runs playwright', () => {
    expect(ci).toMatch(/npm run test/);
    expect(ci).toMatch(/npm run test:e2e/);
  });

  test('no stray files in .github/workflows', () => {
    const files = fs.readdirSync(path.join('.github', 'workflows'));
    expect(files.filter((f) => !f.endsWith('.yml'))).toEqual([]);
  });

  test('deploy workflow is manual-only (workflow_dispatch) and never auto-pushes to prod', () => {
    const deploy = fs.readFileSync(deployPath, 'utf8');
    expect(deploy).toMatch(/workflow_dispatch/);
    expect(deploy).not.toMatch(/on:\s*\n\s*push/);
  });
});

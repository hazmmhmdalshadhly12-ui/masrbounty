/**
 * Cloudflare Workers (workerd) fetch safety guard.
 *
 * The Workers runtime throws
 *   "Error: The 'cache' field on 'RequestInitializerDict' is not implemented."
 * the moment a server-side fetch init carries a `cache` field. Node.js and
 * Jest both tolerate the field, so no network-level unit test can catch this
 * regression — it only detonates in production. The files listed below all
 * run server-side on Workers; this test statically forbids the field there.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Server-executed files whose fetch() calls land on the Workers runtime. */
const WORKERD_SERVER_FILES = [
  'lib/ai/client.ts',
  'lib/security/dns-txt.ts',
  'services/verification.ts',
  'components/programs/program-builder/actions.ts',
];

describe('workerd fetch safety', () => {
  it('server-side fetch inits never carry a `cache` field', () => {
    const violations: string[] = [];
    for (const rel of WORKERD_SERVER_FILES) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      if (/cache:\s*['"]/.test(src)) violations.push(rel);
    }
    expect(violations).toEqual([]);
  });
});

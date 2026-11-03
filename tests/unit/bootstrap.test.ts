/**
 * ensureUserBootstrap / ensureServerBootstrap (Phase 3 acceptance):
 *  - creates profile/role/researcher rows exactly once per missing row
 *  - idempotent under races (upsert + ignoreDuplicates)
 *  - NEVER throws, even when the DB is unreachable
 *  - failures are logged (console.error) and recorded as security events
 */
jest.mock('@/lib/supabase/admin', () => {
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  const tables: Record<string, { upsert: jest.Mock; insert: jest.Mock; select: jest.Mock }> = {};
  const makeFrom = (table: string) => {
    if (!tables[table]) {
      tables[table] = {
        upsert: jest.fn(async (payload: unknown) => {
          calls.push({ table, op: 'upsert', payload });
          return { error: null };
        }),
        insert: jest.fn(async (payload: unknown) => {
          calls.push({ table, op: 'insert', payload });
          return { error: null };
        }),
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      };
    }
    return tables[table]!;
  };
  const db = { from: jest.fn((t: string) => makeFrom(t)) };
  return { createAdminClient: () => db, __db: db, __calls: calls, __tables: tables };
});


import { ensureServerBootstrap } from '@/lib/auth/server-bootstrap';
import { createAdminClient } from '@/lib/supabase/admin';

function ops(): { table: string; op: string }[] {
  
  const calls = (require('@/lib/supabase/admin') as any).__calls as { table: string; op: string }[];
  return calls.map((c) => ({ table: c.table, op: c.op }));
}

beforeEach(() => {
  
  (require('@/lib/supabase/admin') as any).__calls.length = 0;
  
  (require('@/lib/supabase/admin') as any).__db.from.mockClear();
});

describe('ensureServerBootstrap', () => {
  test('researcher: heals profile + role + researcher row, idempotently', async () => {
    await ensureServerBootstrap('u-111', { username: 'hazem', role: 'researcher' });
    const tables = ops().map((o) => o.table);
    expect(tables).toContain('profiles');
    expect(tables).toContain('user_roles');
    expect(tables).toContain('researcher_profiles');
    expect(tables).not.toContain('company_profiles');
    // upserts carry ignoreDuplicates so concurrent register + heal cannot dupe
    for (const c of ops()) expect(c.op).toBe('upsert');
    // role clamped to allowed enum — never admin from browser metadata
    const db = createAdminClient() as unknown as { from: (t: string) => { upsert: jest.Mock } };
    const roleCalls = db.from('user_roles').upsert.mock.calls as unknown as [
      { user_id: string; role: string },
    ][];
    expect(roleCalls[0][0].role).toBe('researcher');
  });

  test('company meta: role row created, no researcher row', async () => {
    await ensureServerBootstrap('u-222', { role: 'company' });
    const tables = ops().map((o) => o.table);
    expect(tables).toContain('profiles');
    expect(tables).toContain('user_roles');
    expect(tables).not.toContain('researcher_profiles');
  });

  test('malformed usernames are sanitized, not trusted', async () => {
    await ensureServerBootstrap('u-333', { username: 'bad name!! 😈' });
    const db = createAdminClient() as unknown as { from: (t: string) => { upsert: jest.Mock } };
    const p = db.from('profiles').upsert.mock.calls[0][0] as { username: string };
    expect(p.username).toMatch(/^[a-zA-Z0-9_]{3,30}$/);
    expect(p.username).not.toContain(' ');
  });

  test('admin role in metadata is ignored (privilege escalation blocked)', async () => {
    await ensureServerBootstrap('u-444', { role: 'admin' as unknown as 'company' });
    const db = createAdminClient() as unknown as { from: (t: string) => { upsert: jest.Mock } };
    const roleCalls = db.from('user_roles').upsert.mock.calls as unknown as [
      { user_id: string; role: string },
    ][];
    expect(roleCalls[0][0].role).toBe('researcher');
  });

  test('DB failure: never throws, logs + records a security event', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const db = createAdminClient() as unknown as { from: (t: string) => { upsert: jest.Mock } };
    db.from = jest.fn(() => ({
      upsert: jest.fn(async () => ({ error: { message: 'connection refused' } })),
      insert: jest.fn(async () => ({ error: null })),
    })) as unknown as any;
    await expect(ensureServerBootstrap('u-555', { role: 'researcher' })).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    const msg = errSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(msg).toContain('bootstrap');
    errSpy.mockRestore();
  });

  test('thrown exception (DB down): never throws', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const db = createAdminClient() as unknown as { from: (t: string) => { upsert: jest.Mock } };
    db.from = jest.fn(() => {
      throw new Error('ECONNREFUSED');
    }) as unknown as any;
    await expect(ensureServerBootstrap('u-666')).resolves.toBeUndefined();
    errSpy.mockRestore();
  });
});

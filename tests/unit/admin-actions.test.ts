import { requireStaff, requireAdminAction } from '@/lib/auth/admin-actions';

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}));

type Chain = Record<string, unknown>;

function makeSupabase(opts: { user?: { id: string; email?: string } | null; roles?: string[] }) {
  const roleQuery: Chain = {};
  roleQuery.eq = jest.fn(() => Promise.resolve({ data: (opts.roles ?? []).map((role) => ({ role })) }));
  const supabase = {
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: opts.user ?? null } })),
    },
    from: jest.fn((_table: string) => ({
      select: jest.fn(() => roleQuery),
    })),
  };
  return supabase;
}

describe('requireStaff (server-side admin gate for server actions)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('passes for admin with allowed role and returns client + user', async () => {
    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as jest.Mock).mockResolvedValue(
      makeSupabase({ user: { id: 'u1', email: 'a@b.c' }, roles: ['admin'] })
    );
    const { supabase, user } = await requireStaff(['admin', 'moderator']);
    expect(user.id).toBe('u1');
    expect(supabase.from).toBeDefined();
  });

  test('throws for authenticated user WITHOUT staff role (researcher blocked)', async () => {
    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as jest.Mock).mockResolvedValue(
      makeSupabase({ user: { id: 'u2' }, roles: ['researcher'] })
    );
    await expect(requireStaff(['admin', 'moderator'])).rejects.toThrow('للإدارة فقط');
  });

  test('throws when no session user', async () => {
    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as jest.Mock).mockResolvedValue(makeSupabase({ user: null, roles: ['admin'] }));
    await expect(requireStaff()).rejects.toThrow('Unauthorized');
  });

  test('moderator is rejected from admin-only operations', async () => {
    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as jest.Mock).mockResolvedValue(
      makeSupabase({ user: { id: 'u3' }, roles: ['moderator'] })
    );
    await expect(requireStaff(['admin'])).rejects.toThrow('للإدارة فقط');
    await expect(requireAdminAction()).rejects.toThrow('للإدارة فقط');
  });
});

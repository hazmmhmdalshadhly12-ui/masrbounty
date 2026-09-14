jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }));

import { createAdminClient } from '@/lib/supabase/admin';
import { notify, reportParties } from '@/lib/notify';

const mockCreate = createAdminClient as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

function adminDb(insert: jest.Mock) {
  return { from: jest.fn(() => ({ insert })) };
}

test('notify inserts into the recipient inbox via service role', async () => {
  const insert = jest.fn(async () => ({}));
  mockCreate.mockReturnValue(adminDb(insert));
  await notify({} as never, 'user-1', { type: 'report', title: 'New report', link: '/dashboard/reports/1' });
  expect(mockCreate).toHaveBeenCalled();
  expect(insert).toHaveBeenCalledWith({
    user_id: 'user-1',
    type: 'report',
    title: 'New report',
    body: null,
    link: '/dashboard/reports/1',
  });
});

test('notify skips empty recipients and never throws', async () => {
  const insert = jest.fn(async () => ({}));
  mockCreate.mockReturnValue(adminDb(insert));
  await expect(notify({} as never, '', { type: 'system', title: 'hi' })).resolves.toBeUndefined();
  expect(insert).not.toHaveBeenCalled();

  mockCreate.mockImplementation(() => {
    throw new Error('no env');
  });
  await expect(notify({} as never, 'u', { type: 'system', title: 'hi' })).resolves.toBeUndefined();

  const failing = jest.fn(async () => {
    throw new Error('db down');
  });
  mockCreate.mockReturnValue(adminDb(failing));
  await expect(notify({} as never, 'u', { type: 'system', title: 'hi' })).resolves.toBeUndefined();
});

function mockDb(reportsRow: unknown, progRow: unknown, membersRows: unknown[]) {
  return {
    from: (table: string) => {
      if (table === 'reports') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: reportsRow }) }) }) };
      }
      if (table === 'programs') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: progRow }) }) }) };
      }
      return { select: () => ({ eq: async () => ({ data: membersRows }) }) };
    },
  };
}

test('reportParties resolves reporter + company members', async () => {
  const db = mockDb(
    { report_number: 'MB-000007', program_id: 'prog-1', researcher_profiles: { user_id: 'researcher-uid' } },
    { company_id: 'co-1' },
    [{ user_id: 'member-1' }, { user_id: 'member-2' }],
  );
  const out = await reportParties(db as never, 'report-1');
  expect(out).toEqual({
    reporterUserId: 'researcher-uid',
    memberUserIds: ['member-1', 'member-2'],
    reportNumber: 'MB-000007',
    programId: 'prog-1',
  });
});

test('reportParties returns empty shape when the report is missing', async () => {
  const db = mockDb(null, null, []);
  const out = await reportParties(db as never, 'missing');
  expect(out.reporterUserId).toBeNull();
  expect(out.memberUserIds).toEqual([]);
});

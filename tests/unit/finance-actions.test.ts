jest.mock('@/lib/supabase/server');
jest.mock('@/lib/auth/admin-actions');
jest.mock('@/services/audit', () => ({ logAudit: jest.fn(async () => undefined) }));
jest.mock('@/lib/notify', () => ({
  notify: jest.fn(async () => undefined),
  notifyCompanyMembers: jest.fn(async () => undefined),
  reportParties: jest.fn(async () => ({ reporterUserId: null, reportNumber: 'MB-000001' })),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: (url: string) => {
    const e = new Error(`NEXT_REDIRECT:${url}`);
    (e as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw e;
  },
}));

import { createServerClient } from '@/lib/supabase/server';
import { requireAdminAction } from '@/lib/auth/admin-actions';
import { revalidatePath } from 'next/cache';
import { approveBountyRewardAction, submitDepositRequestAction } from '@/features/finance/company-actions';
import { financeError } from '@/lib/finance/errors';
import {
  reviewDepositRequestV2Action,
  setCommissionRateAction,
  failRewardPayoutAction,
} from '@/features/finance/admin-actions';

const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const PROGRAM_ID = '33333333-3333-4333-8333-333333333333';
const COMPANY_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '55555555-5555-4555-8555-555555555555';

type Chain = Record<string, unknown>;

/** Build a chainable fake query for one table (covers eq/order/limit tails). */
function singleChain(row: unknown) {
  const tail = {
    single: jest.fn(async () => ({ data: row, error: null })),
    maybeSingle: jest.fn(async () => ({ data: row, error: null })),
  };
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        ...tail,
        eq: jest.fn(() => ({
          ...tail,
          order: jest.fn(() => ({
            limit: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: row, error: null })) })),
          })),
          limit: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: row, error: null })) })),
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: row, error: null })) })),
        })),
        limit: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: row, error: null })) })),
      })),
    })),
  };
}

function makeSupabase(rpcError: { message: string } | null = null) {
  const rpc = jest.fn(async () => ({ data: null, error: rpcError }));
  const tables: Record<string, Chain> = {
    reports: singleChain({ program_id: PROGRAM_ID }),
    programs: singleChain({ company_id: COMPANY_ID }),
    company_members: singleChain({ role: 'owner' }),
    wallet_deposit_requests: singleChain(null),
  };
  return {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: USER_ID } } })) },
    from: jest.fn((t: string) => tables[t] ?? singleChain(null)),
    rpc,
    __rpc: rpc,
  };
}

function mockServer(supabase: ReturnType<typeof makeSupabase>) {
  (createServerClient as jest.Mock).mockResolvedValue(supabase);
}

describe('approveBountyRewardAction — explicit confirmation + idempotency', () => {
  beforeEach(() => jest.clearAllMocks());

  test('refuses to run without the explicit confirm flag (never reaches RPC)', async () => {
    const supabase = makeSupabase();
    mockServer(supabase);
    const fd = new FormData();
    fd.set('amount', '1500');
    // confirm missing on purpose
    await expect(approveBountyRewardAction(REPORT_ID, fd)).rejects.toThrow(/تأكيد/);
    expect(supabase.__rpc).not.toHaveBeenCalled();
  });

  test('invalid amount rejected before the RPC', async () => {
    const supabase = makeSupabase();
    mockServer(supabase);
    const fd = new FormData();
    fd.set('amount', '12.345'); // >2 decimals
    fd.set('confirm', 'true');
    await expect(approveBountyRewardAction(REPORT_ID, fd)).rejects.toThrow(/مبلغ|صحيح/);
    expect(supabase.__rpc).not.toHaveBeenCalled();
  });

  test('happy path: forwards integer piastres + idempotency key to the RPC', async () => {
    const supabase = makeSupabase();
    mockServer(supabase);
    const fd = new FormData();
    fd.set('amount', '1500.75');
    fd.set('confirm', 'true');
    fd.set('idempotency_key', 'reward-ui:test-12345678');
    await approveBountyRewardAction(REPORT_ID, fd);
    expect(supabase.__rpc).toHaveBeenCalledWith(
      'approve_bounty_reward',
      expect.objectContaining({
        p_report: REPORT_ID,
        p_reward_amount_minor: 150075,
        p_confirm: true,
        p_idempotency_key: 'reward-ui:test-12345678',
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/company/reports/${REPORT_ID}`);
  });

  test('maps SQL errors to Arabic user messages', async () => {
    const supabase = makeSupabase({ message: 'insufficient funds' });
    mockServer(supabase);
    const fd = new FormData();
    fd.set('amount', '1500');
    fd.set('confirm', 'true');
    await expect(approveBountyRewardAction(REPORT_ID, fd)).rejects.toThrow('الرصيد المتاح لا يكفي — اشحن محفظتك أولًا');
  });

  test('non-money roles are rejected before the RPC', async () => {
    const supabase = makeSupabase();
    (supabase.from as jest.Mock).mockImplementation((t: string) =>
      t === 'company_members' ? singleChain({ role: 'viewer' }) : singleChain(t === 'reports' ? { program_id: PROGRAM_ID } : { company_id: COMPANY_ID })
    );
    mockServer(supabase);
    const fd = new FormData();
    fd.set('amount', '1500');
    fd.set('confirm', 'true');
    await expect(approveBountyRewardAction(REPORT_ID, fd)).rejects.toThrow(/غير مصر/);
    expect(supabase.__rpc).not.toHaveBeenCalled();
  });
});

describe('financeError mapping', () => {
  test('covers the full SQL error vocabulary', () => {
    expect(financeError({ message: 'confirmation required' })).toMatch(/تأكيد/);
    expect(financeError({ message: 'insufficient funds' })).toMatch(/لا يكفي/);
    expect(financeError({ message: 'report not accepted' })).toMatch(/مقبول/);
    expect(financeError({ message: 'invalid state' })).toMatch(/حالة/);
    expect(financeError({ message: 'no commission configured' })).toMatch(/عمولة/);
    expect(financeError(null)).toMatch(/تعذّر/);
  });
});

describe('submitDepositRequestAction — apply -> review -> credit ONCE', () => {
  beforeEach(() => jest.clearAllMocks());

  test('files a pending request with integer piastres (never credits directly)', async () => {
    const supabase = makeSupabase();
    mockServer(supabase);
    let inserted: unknown = null;
    (supabase.from as jest.Mock).mockImplementation((t: string) => {
      if (t === 'company_members') return singleChain({ company_id: COMPANY_ID, role: 'owner' });
      if (t === 'wallet_deposit_requests') {
        return {
          insert: jest.fn((row: unknown) => {
            inserted = row;
            return Promise.resolve({ error: null });
          }),
        } as unknown as Chain;
      }
      return singleChain(null);
    });
    const fd = new FormData();
    fd.set('amount', '5000.50');
    fd.set('method', 'instapay');
    fd.set('reference', 'IP-99881');
    await expect(submitDepositRequestAction(fd)).rejects.toThrow(/NEXT_REDIRECT/); // redirect(ok)
    expect(inserted).toMatchObject({
      company_id: COMPANY_ID,
      amount_minor: 500050,
      status: 'pending',
      method: 'instapay',
    });
  });

  test('viewer role cannot file deposit requests', async () => {
    const supabase = makeSupabase();
    (supabase.from as jest.Mock).mockImplementation((t: string) =>
      t === 'company_members' ? singleChain({ company_id: COMPANY_ID, role: 'viewer' }) : singleChain(null)
    );
    mockServer(supabase);
    const fd = new FormData();
    fd.set('amount', '5000');
    fd.set('method', 'bank');
    fd.set('reference', 'BANK-1');
    await expect(submitDepositRequestAction(fd)).rejects.toThrow(/NEXT_REDIRECT.*%D8%B5%D9%84%D8%A7%D8%AD%D9%8A%D8%A9|NEXT_REDIRECT/s);
  });
});

describe('admin finance actions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('reviewDepositRequestV2Action calls the v2 RPC with a deterministic idempotency key', async () => {
    const supabase = makeSupabase();
    (requireAdminAction as jest.Mock).mockResolvedValue({ supabase, user: { id: USER_ID } });
    await reviewDepositRequestV2Action('aaaaaaaa-1111-4111-8111-111111111111', true, 'ok');
    expect(supabase.__rpc).toHaveBeenCalledWith('review_deposit_request_v2', expect.objectContaining({
      p_request: 'aaaaaaaa-1111-4111-8111-111111111111',
      p_approve: true,
      p_idempotency_key: 'deposit-review:aaaaaaaa-1111-4111-8111-111111111111',
    }));
  });

  test('reviewDepositRequestV2Action is admin-gated', async () => {
    (requireAdminAction as jest.Mock).mockRejectedValue(new Error('للإدارة فقط'));
    await expect(reviewDepositRequestV2Action('aaaaaaaa-1111-4111-8111-111111111111', true)).rejects.toThrow('للإدارة فقط');
  });

  test('failRewardPayoutAction passes the refund reason through', async () => {
    const supabase = makeSupabase();
    (requireAdminAction as jest.Mock).mockResolvedValue({ supabase, user: { id: USER_ID } });
    await failRewardPayoutAction('bbbbbbbb-2222-4222-8222-222222222222', 'bank rejected transfer', false);
    expect(supabase.__rpc).toHaveBeenCalledWith('fail_reward_payout', expect.objectContaining({
      p_payout: 'bbbbbbbb-2222-4222-8222-222222222222',
      p_reason: 'bank rejected transfer',
      p_cancel: false,
    }));
  });

  test('setCommissionRateAction redirects on invalid rate (never reaches RPC)', async () => {
    const supabase = makeSupabase();
    (requireAdminAction as jest.Mock).mockResolvedValue({ supabase, user: { id: USER_ID } });
    const fd = new FormData();
    fd.set('scope', 'global');
    fd.set('rate_percent', '120'); // out of range
    fd.set('reason', 'tuning');
    await expect(setCommissionRateAction(fd)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(supabase.__rpc).not.toHaveBeenCalled();
  });

  test('setCommissionRateAction forwards basis points (20% -> 2000 bp)', async () => {
    const supabase = makeSupabase();
    (requireAdminAction as jest.Mock).mockResolvedValue({ supabase, user: { id: USER_ID } });
    const fd = new FormData();
    fd.set('scope', 'global');
    fd.set('rate_percent', '20');
    fd.set('reason', 'standard rate');
    await expect(setCommissionRateAction(fd)).rejects.toThrow(/NEXT_REDIRECT/); // ends in redirect(ok)
    expect(supabase.__rpc).toHaveBeenCalledWith('set_commission_rate', expect.objectContaining({
      p_scope: 'global',
      p_rate_bp: 2000,
      p_reason: 'standard rate',
    }));
  });
});

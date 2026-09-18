import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { notify, reportParties } from '@/lib/notify';

export type ServiceResult<T> = { data: T | null; error: string | null };

export type BountyStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface BountyAward {
  id: string;
  report_id: string;
  amount: number;
  status: BountyStatus;
  awarded_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface BountyPayment {
  id: string;
  award_id: string;
  amount: number;
  status: string;
  reference: string | null;
  created_at: string;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

function moneyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (/unauthorized/i.test(msg)) return 'Unauthorized — sign in first';
  if (/forbidden/i.test(msg)) return 'Forbidden for this operation';
  if (/already awarded|already paid|already decided/i.test(msg)) return 'Already processed';
  if (/insufficient balance/i.test(msg)) return 'Insufficient balance';
  if (/reference required/i.test(msg)) return 'Payment reference required';
  if (/invalid amount/i.test(msg)) return 'Invalid amount';
  if (/not found/i.test(msg)) return 'Not found';
  return msg || 'Operation failed — try again';
}

function isMissingRpc(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return /Could not find the function|schema cache|function .* does not exist/i.test(msg);
}

async function requireCompanyRoleForReport(db: Db, reportId: string): Promise<string> {
  const { data: auth } = await db.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('unauthorized');
  const { data: report } = await db.from('reports').select('id,program_id').eq('id', reportId).single();
  if (!report) throw new Error('not found');
  const { data: prog } = await db
    .from('programs')
    .select('company_id')
    .eq('id', (report as { program_id: string }).program_id)
    .single();
  if (prog) {
    const { data: member } = await db
      .from('company_members')
      .select('id')
      .eq('company_id', (prog as { company_id: string }).company_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (member) return userId;
  }
  const { data: roles } = await db.from('user_roles').select('role').eq('user_id', userId);
  if ((roles ?? []).some((r: { role: string }) => r.role === 'admin')) return userId;
  throw new Error('forbidden');
}

/**
 * Award a bounty. Primary path is the public.award_bounty RPC (membership,
 * idempotency and wallet movement enforced in-DB). Falls back to direct
 * writes when the RPC is unavailable and RLS permits (admin/staff context).
 */
export async function awardBounty(
  reportId: string,
  amount: number,
  client?: Db
): Promise<ServiceResult<BountyAward>> {
  try {
    if (!reportId) return { data: null, error: 'Report id required' };
    if (typeof amount !== 'number' || Number.isNaN(amount) || amount < 0) {
      return { data: null, error: 'Invalid amount' };
    }
    const db = await getDb(client);
    await requireCompanyRoleForReport(db, reportId);

    const { data: awardId, error: rpcError } = await db.rpc('award_bounty', {
      p_report: reportId,
      p_amount: amount,
    });
    if (!rpcError && awardId) {
      const { data: award } = await db.from('bounty_awards').select('*').eq('id', awardId as string).single();
      const parties = await reportParties(db, reportId);
      if (parties.reporterUserId) {
        await notify(db, parties.reporterUserId, {
          type: 'bounty',
          title: `Bounty ${amount} on report ${parties.reportNumber}`,
          link: '/dashboard/payments',
        });
      }
      try {
        revalidatePath(`/company/reports/${reportId}`);
      } catch {
        /* ignore */
      }
      return { data: (award ?? { id: awardId }) as BountyAward, error: null };
    }
    if (rpcError && !isMissingRpc(rpcError)) {
      return { data: null, error: moneyError(rpcError) };
    }

    // Fallback: direct writes permitted by RLS in admin/staff context.
    const { data: auth } = await db.auth.getUser();
    const { data, error } = await db
      .from('bounty_awards')
      .upsert(
        { report_id: reportId, amount, status: 'approved', awarded_by: auth.user?.id ?? null },
        { onConflict: 'report_id' }
      )
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Award failed' };
    await db.from('reports').update({ status: 'accepted', bounty_amount: amount }).eq('id', reportId);
    await logAudit('award', 'bounty_awards', (data as BountyAward).id, { report_id: reportId, amount }, auth.user?.id);
    // best-effort bounty notification (fallback path)
    try {
      const parties = await reportParties(db, reportId);
      if (parties.reporterUserId) {
        await notify(db, parties.reporterUserId, {
          type: 'bounty',
          title: `Bounty ${amount} on report ${parties.reportNumber}`,
          link: '/dashboard/payments',
        });
      }
    } catch {
      /* notify best-effort */
    }
    try {
      revalidatePath(`/company/reports/${reportId}`);
    } catch {
      /* ignore */
    }
    return { data: data as BountyAward, error: null };
  } catch (e) {
    return { data: null, error: moneyError(e) };
  }
}

export async function getBounties(
  filters?: { reportId?: string; status?: BountyStatus; limit?: number },
  client?: Db
): Promise<ServiceResult<BountyAward[]>> {
  try {
    const db = await getDb(client);
    let q = db.from('bounty_awards').select('*').order('created_at', { ascending: false });
    if (filters?.reportId) q = q.eq('report_id', filters.reportId);
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.limit) q = q.limit(filters.limit);
    const { data, error } = await q;
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as BountyAward[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function getBountyByReport(reportId: string, client?: Db): Promise<ServiceResult<BountyAward>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db.from('bounty_awards').select('*').eq('report_id', reportId).maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: (data ?? null) as BountyAward | null, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Mark an award paid. Primary path is public.pay_award RPC with direct-write fallback. */
export async function payAward(
  awardId: string,
  reference: string,
  client?: Db
): Promise<ServiceResult<BountyPayment>> {
  try {
    const ref = reference.trim().slice(0, 120);
    if (!ref) return { data: null, error: 'Payment reference required' };
    const db = await getDb(client);
    const { error: rpcError } = await db.rpc('pay_award', { p_award: awardId, p_reference: ref });
    if (!rpcError) {
      const { data } = await db
        .from('bounty_payments')
        .select('*')
        .eq('award_id', awardId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      // best-effort payment notification
      try {
        const { data: aw } = await db.from('bounty_awards').select('report_id').eq('id', awardId).maybeSingle();
        const rid = (aw as { report_id: string } | null)?.report_id;
        if (rid) {
          const parties = await reportParties(db, rid);
          if (parties.reporterUserId) {
            await notify(db, parties.reporterUserId, {
              type: 'payment',
              title: `تم دفع المكافأة — مرجع ${ref}`,
              link: '/dashboard/payments',
            });
          }
        }
      } catch {
        /* notify best-effort */
      }
      try {
        revalidatePath('/company/payments');
      } catch {
        /* ignore */
      }
      return { data: (data ?? { id: awardId, award_id: awardId, reference: ref }) as BountyPayment, error: null };
    }
    if (!isMissingRpc(rpcError)) return { data: null, error: moneyError(rpcError) };

    const { data: award } = await db.from('bounty_awards').select('id,amount,report_id').eq('id', awardId).single();
    if (!award) return { data: null, error: 'Award not found' };
    const { data: auth } = await db.auth.getUser();
    const { data: payment, error } = await db
      .from('bounty_payments')
      .insert({
        award_id: awardId,
        amount: (award as { amount: number }).amount,
        status: 'completed',
        reference: ref,
        processed_by: auth.user?.id ?? null,
      })
      .select('*')
      .single();
    if (error || !payment) return { data: null, error: error?.message ?? 'Payment failed' };
    await db.from('bounty_awards').update({ status: 'paid', decided_at: new Date().toISOString() }).eq('id', awardId);
    await logAudit('payout', 'bounty_awards', awardId, { reference: ref }, auth.user?.id);
    // best-effort payment notification (fallback path)
    try {
      const rid = (award as { report_id: string }).report_id;
      const parties = await reportParties(db, rid);
      if (parties.reporterUserId) {
        await notify(db, parties.reporterUserId, {
          type: 'payment',
          title: `تم دفع المكافأة — مرجع ${ref}`,
          link: '/dashboard/payments',
        });
      }
    } catch {
      /* notify best-effort */
    }
    try {
      revalidatePath('/company/payments');
    } catch {
      /* ignore */
    }
    return { data: payment as BountyPayment, error: null };
  } catch (e) {
    return { data: null, error: moneyError(e) };
  }
}

export async function listBountyPayments(awardId: string, client?: Db): Promise<ServiceResult<BountyPayment[]>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db
      .from('bounty_payments')
      .select('*')
      .eq('award_id', awardId)
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as BountyPayment[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

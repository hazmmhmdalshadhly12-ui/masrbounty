import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notify';

export type ServiceResult<T> = { data: T | null; error: string | null };

export type PayoutStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';

export interface PayoutRequest {
  id: string;
  researcher_id: string;
  amount: number;
  status: PayoutStatus;
  payment_method_id: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

function payoutError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (/unauthorized/i.test(msg)) return 'Unauthorized — sign in first';
  if (/forbidden/i.test(msg)) return 'Forbidden for this operation';
  if (/already decided/i.test(msg)) return 'This request was already decided';
  if (/insufficient/i.test(msg)) return 'Researcher balance is insufficient';
  if (/must approve/i.test(msg)) return 'Approve funding first';
  if (/reference required/i.test(msg)) return 'Payment reference required';
  if (/not found/i.test(msg)) return 'Not found';
  return msg || 'Operation failed — try again';
}

async function ownResearcherId(db: Db): Promise<string> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error('unauthorized');
  const { data: rp } = await db.from('researcher_profiles').select('id').eq('user_id', auth.user.id).single();
  if (!rp) throw new Error('Researcher profile not found');
  return (rp as { id: string }).id;
}

/** Researcher requests a withdrawal of their available balance. */
export async function requestPayout(
  amount: number,
  paymentMethodId?: string | null,
  client?: Db
): Promise<ServiceResult<PayoutRequest>> {
  try {
    if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      return { data: null, error: 'Amount must be greater than zero' };
    }
    const db = await getDb(client);
    const researcherId = await ownResearcherId(db);
    if (paymentMethodId) {
      const { data: pm } = await db
        .from('payment_methods')
        .select('id')
        .eq('id', paymentMethodId)
        .eq('researcher_id', researcherId)
        .maybeSingle();
      if (!pm) return { data: null, error: 'Payment method not found' };
    }
    const { data: wallet } = await db.from('wallets').select('balance').eq('researcher_id', researcherId).maybeSingle();
    const balance = Number((wallet as { balance: number } | null)?.balance ?? 0);
    if (balance < amount) return { data: null, error: 'Insufficient balance' };
    const { data, error } = await db
      .from('payout_requests')
      .insert({ researcher_id: researcherId, amount, payment_method_id: paymentMethodId ?? null, status: 'pending' })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Request failed' };
    try {
      revalidatePath('/dashboard/payments');
    } catch {
      /* ignore */
    }
    return { data: data as PayoutRequest, error: null };
  } catch (e) {
    return { data: null, error: payoutError(e) };
  }
}

export async function listPayouts(
  filters?: { researcherId?: string; status?: PayoutStatus; limit?: number },
  client?: Db
): Promise<ServiceResult<PayoutRequest[]>> {
  try {
    const db = await getDb(client);
    let q = db.from('payout_requests').select('*').order('created_at', { ascending: false });
    if (filters?.researcherId) q = q.eq('researcher_id', filters.researcherId);
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.limit) q = q.limit(filters.limit);
    const { data, error } = await q;
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as PayoutRequest[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function getPayout(id: string, client?: Db): Promise<ServiceResult<PayoutRequest>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db.from('payout_requests').select('*').eq('id', id).single();
    if (error || !data) return { data: null, error: error?.message ?? 'Not found' };
    return { data: data as PayoutRequest, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Admin: approve (escrow funding) or reject a pending payout via public.settle_payout. */
export async function settlePayout(
  payoutId: string,
  approve: boolean,
  client?: Db
): Promise<ServiceResult<PayoutRequest>> {
  try {
    const db = await getDb(client);
    const { error } = await db.rpc('settle_payout', { p_payout: payoutId, p_approve: approve });
    if (error) return { data: null, error: payoutError(error) };
    const { data: payout } = await db.from('payout_requests').select('*').eq('id', payoutId).single();
    if (payout) {
      const { data: rp } = await db
        .from('researcher_profiles')
        .select('user_id')
        .eq('id', (payout as { researcher_id: string }).researcher_id)
        .single();
      const uid = (rp as { user_id: string } | null)?.user_id;
      if (uid) {
        await notify(db, uid, {
          type: 'payment',
          title: approve
            ? `Payout of ${(payout as { amount: number }).amount} approved`
            : 'Payout request rejected',
          body: approve ? 'Funds are on the way per your payment method' : 'Check your payment method or contact support',
          link: '/dashboard/payments',
        });
      }
    }
    try {
      revalidatePath('/admin/payments');
    } catch {
      /* ignore */
    }
    return { data: (payout ?? { id: payoutId }) as PayoutRequest, error: null };
  } catch (e) {
    return { data: null, error: payoutError(e) };
  }
}

/** Admin: mark an approved (funded) payout completed with an external reference. */
export async function completePayout(
  payoutId: string,
  reference: string,
  client?: Db
): Promise<ServiceResult<PayoutRequest>> {
  try {
    const ref = reference.trim().slice(0, 120);
    if (!ref) return { data: null, error: 'Payment reference required' };
    const db = await getDb(client);
    const { error } = await db.rpc('complete_payout', { p_payout: payoutId, p_reference: ref });
    if (error) return { data: null, error: payoutError(error) };
    const { data: payout } = await db.from('payout_requests').select('*').eq('id', payoutId).single();
    if (payout) {
      const { data: rp } = await db
        .from('researcher_profiles')
        .select('user_id')
        .eq('id', (payout as { researcher_id: string }).researcher_id)
        .single();
      const uid = (rp as { user_id: string } | null)?.user_id;
      if (uid) {
        await notify(db, uid, {
          type: 'payment',
          title: `Payout sent — ref ${ref}`,
          link: '/dashboard/payments',
        });
      }
    }
    try {
      revalidatePath('/admin/payments');
    } catch {
      /* ignore */
    }
    return { data: (payout ?? { id: payoutId }) as PayoutRequest, error: null };
  } catch (e) {
    return { data: null, error: payoutError(e) };
  }
}

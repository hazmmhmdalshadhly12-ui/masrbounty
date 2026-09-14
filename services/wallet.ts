import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type ServiceResult<T> = { data: T | null; error: string | null };

export type TxnType = 'bounty' | 'payout' | 'refund' | 'adjustment';

export interface Wallet {
  id: string;
  researcher_id: string;
  balance: number;
  pending_balance: number;
  total_earned: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: TxnType;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

export async function logWalletEvent(action: string, entity: string, entityId?: string, meta: unknown = {}) {
  try {
    const db = createAdminClient();
    await db.from('audit_logs').insert({ action, entity, entity_id: entityId ?? null, metadata: meta as object });
  } catch {
    /* noop */
  }
}

async function researcherIdForUser(db: Db, userId: string): Promise<string | null> {
  const { data } = await db.from('researcher_profiles').select('id').eq('user_id', userId).maybeSingle();
  return ((data as { id: string } | null)?.id ?? null);
}

/** Fetch a wallet by researcher id, or the caller's own wallet when omitted. */
export async function getWallet(researcherId?: string, client?: Db): Promise<ServiceResult<Wallet>> {
  try {
    const db = await getDb(client);
    let rid = researcherId;
    if (!rid) {
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) return { data: null, error: 'Unauthorized' };
      const found = await researcherIdForUser(db, auth.user.id);
      if (!found) return { data: null, error: 'Researcher profile not found' };
      rid = found;
    }
    const { data, error } = await db.from('wallets').select('*').eq('researcher_id', rid).maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: (data ?? null) as Wallet | null, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/**
 * Ensure a wallet row exists for a researcher. Reads go through the caller's
 * client (RLS); the compensating insert uses the service role because wallets
 * intentionally expose no public INSERT policy.
 */
export async function ensureWallet(researcherId: string, client?: Db): Promise<ServiceResult<Wallet>> {
  try {
    const existing = await getWallet(researcherId, client);
    if (existing.data || existing.error !== null) return existing;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('wallets')
      .upsert({ researcher_id: researcherId }, { onConflict: 'researcher_id' })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Ensure failed' };
    return { data: data as Wallet, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function listWalletTransactions(
  walletId: string,
  limit = 50,
  client?: Db
): Promise<ServiceResult<WalletTransaction[]>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as WalletTransaction[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

/** Transactions for the caller's own wallet (resolves wallet id server-side). */
export async function getOwnTransactions(limit = 50, client?: Db): Promise<ServiceResult<WalletTransaction[]>> {
  try {
    const db = await getDb(client);
    const wallet = await getWallet(undefined, db);
    if (!wallet.data) return { data: null, error: wallet.error ?? 'Wallet not found' };
    return listWalletTransactions(wallet.data.id, limit, db);
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

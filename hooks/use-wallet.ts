'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// محفظة الباحث: الرصيد + المعاملات + طلبات السحب (RLS: المالك فقط)
export interface WalletRow {
  id: string;
  researcher_id: string;
  balance: number | string;
  pending_balance: number | string;
  total_earned: number | string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: string;
  amount: number | string;
  balance_after: number | string;
  note: string | null;
  created_at: string;
}

export interface PayoutRequest {
  id: string;
  researcher_id: string;
  amount: number | string;
  status: string;
  created_at: string;
}

export interface WalletData {
  wallet: WalletRow | null;
  transactions: WalletTransaction[];
  payouts: PayoutRequest[];
}

export function useWallet(researcherId?: string) {
  return useQuery({
    queryKey: ['wallet', researcherId ?? 'me'],
    staleTime: 30_000,
    queryFn: async (): Promise<WalletData> => {
      const supabase = createClient();
      let rid = researcherId;
      if (!rid) {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        if (!uid) throw new Error('Not authenticated');
        const { data: rp, error } = await supabase
          .from('researcher_profiles')
          .select('id')
          .eq('user_id', uid)
          .single();
        if (error || !rp) throw new Error('Researcher profile not found');
        rid = (rp as { id: string }).id;
      }

      const { data: wallet, error: wErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('researcher_id', rid)
        .single();
      if (wErr) throw wErr;

      const w = wallet as WalletRow;
      const [{ data: txns }, { data: payouts }] = await Promise.all([
        supabase
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', w.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('payout_requests')
          .select('*')
          .eq('researcher_id', rid)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      return {
        wallet: w,
        transactions: ((txns ?? []) as WalletTransaction[]),
        payouts: ((payouts ?? []) as PayoutRequest[]),
      };
    },
  });
}

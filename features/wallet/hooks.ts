'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { PayoutRequest, Wallet, WalletTransaction } from './types';

export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: async (): Promise<Wallet | null> => {
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Unauthorized');
      const { data: rp } = await supabase
        .from('researcher_profiles')
        .select('id')
        .eq('user_id', user.user.id)
        .maybeSingle();
      if (!rp) return null;
      const { data, error } = await supabase
        .from('wallets')
        .select('id,researcher_id,balance,pending_balance,total_earned,created_at,updated_at')
        .eq('researcher_id', (rp as { id: string }).id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as Wallet | null;
    },
  });
}

export function useWalletTransactions(walletId: string) {
  return useQuery({
    queryKey: ['wallet', walletId, 'transactions'],
    queryFn: async (): Promise<WalletTransaction[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('id,wallet_id,type,amount,balance_after,reference_id,note,created_by,created_at')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as WalletTransaction[];
    },
    enabled: Boolean(walletId),
  });
}

export function usePayoutRequests() {
  return useQuery({
    queryKey: ['wallet', 'payouts'],
    queryFn: async (): Promise<PayoutRequest[]> => {
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Unauthorized');
      const { data: rp } = await supabase
        .from('researcher_profiles')
        .select('id')
        .eq('user_id', user.user.id)
        .maybeSingle();
      if (!rp) return [];
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('researcher_id', (rp as { id: string }).id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PayoutRequest[];
    },
  });
}

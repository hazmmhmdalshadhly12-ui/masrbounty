export interface WalletItem {
  id: string;
  created_at: string;
}

export type TxnType = 'bounty' | 'payout' | 'refund' | 'adjustment';
export type PayoutStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
export type PaymentMethodType = 'bank' | 'wallet' | 'vodafone_cash' | 'instapay' | 'other';

export interface Wallet extends WalletItem {
  researcher_id: string;
  balance: number;
  pending_balance: number;
  total_earned: number;
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
  created_by: string | null;
  created_at: string;
}

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

export interface PaymentMethod {
  id: string;
  researcher_id: string;
  type: PaymentMethodType;
  label: string;
  details: Record<string, string | number | boolean | null>;
  is_default: boolean;
  created_at: string;
}

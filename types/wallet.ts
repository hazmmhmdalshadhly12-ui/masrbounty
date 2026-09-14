export type BountyStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type PayoutStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
export type TxnType = 'bounty' | 'payout' | 'refund' | 'adjustment';
export type PaymentMethodType = 'bank' | 'wallet' | 'vodafone_cash' | 'instapay' | 'other';

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
  created_by: string | null;
  created_at: string;
}

/** Legacy alias kept for backwards compatibility. */
export type Txn = WalletTransaction;

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
  status: PaymentStatus;
  reference: string | null;
  processed_by: string | null;
  created_at: string;
  updated_at: string;
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

export type BountyStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type PayoutStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
export type TxnType = 'bounty' | 'payout' | 'refund' | 'adjustment' | 'deposit';
export type DepositStatus = 'pending' | 'approved' | 'rejected';
export type DepositMethod = 'vodafone_cash' | 'instapay' | 'bank' | 'other';
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

export interface CompanyWallet {
  id: string;
  company_id: string;
  balance: number;
  pending_balance: number;
  total_funded: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyWalletTransaction {
  id: string;
  company_wallet_id: string;
  type: TxnType;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DepositRequest {
  id: string;
  company_id: string;
  amount: number;
  method: DepositMethod;
  sender_name: string | null;
  reference: string;
  note: string | null;
  status: DepositStatus;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

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

/** One ledger row in the unified admin money ledger. */
export interface LedgerEntry {
  id: string;
  side: 'researcher' | 'company';
  owner_label: string;
  type: TxnType;
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
}
